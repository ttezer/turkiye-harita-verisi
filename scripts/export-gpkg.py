#!/usr/bin/env python

import argparse
import json
import os
import sqlite3
import struct
import sys
from datetime import datetime, timezone


WGS84_DEFINITION = (
    'GEOGCS["WGS 84",DATUM["WGS_1984",'
    'SPHEROID["WGS 84",6378137,298.257223563]],'
    'PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]'
)


def quote_identifier(value):
    return '"' + str(value).replace('"', '""') + '"'


def json_default(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def infer_sql_type(rows, key):
    for row in rows:
        value = row.get(key)
        if value is None:
            continue
        if isinstance(value, bool):
            return "INTEGER"
        if isinstance(value, int):
            return "INTEGER"
        if isinstance(value, float):
            return "REAL"
        return "TEXT"
    return "TEXT"


def normalize_value(value):
    if value is None:
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float, str)):
        if isinstance(value, str):
            return value.encode("utf-8", "replace").decode("utf-8")
        return value
    return json_default(value)


def iter_points(coordinates):
    if isinstance(coordinates, list):
        if len(coordinates) >= 2 and isinstance(coordinates[0], (int, float)) and isinstance(coordinates[1], (int, float)):
            yield coordinates[0], coordinates[1]
            return
        for item in coordinates:
            yield from iter_points(item)


def compute_bbox(features):
    min_x = float("inf")
    min_y = float("inf")
    max_x = float("-inf")
    max_y = float("-inf")

    for feature in features:
        for x, y in iter_points(feature["geometry"]["coordinates"]):
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)

    if min_x == float("inf"):
        raise ValueError("Cannot compute bbox for empty feature set")

    return min_x, min_y, max_x, max_y


def pack_point(x, y):
    return struct.pack("<2d", float(x), float(y))


def polygon_to_wkb(geometry):
    rings = geometry["coordinates"]
    out = bytearray()
    out.extend(struct.pack("<BI", 1, 3))
    out.extend(struct.pack("<I", len(rings)))
    for ring in rings:
        out.extend(struct.pack("<I", len(ring)))
        for x, y in ring:
            out.extend(pack_point(x, y))
    return bytes(out)


def multipolygon_to_wkb(geometry):
    polygons = geometry["coordinates"]
    out = bytearray()
    out.extend(struct.pack("<BI", 1, 6))
    out.extend(struct.pack("<I", len(polygons)))
    for polygon in polygons:
        out.extend(polygon_to_wkb({"type": "Polygon", "coordinates": polygon}))
    return bytes(out)


def geometry_to_wkb(geometry):
    geometry_type = geometry["type"]
    if geometry_type == "Polygon":
        return polygon_to_wkb(geometry)
    if geometry_type == "MultiPolygon":
        return multipolygon_to_wkb(geometry)
    raise ValueError(f"Unsupported geometry type for GeoPackage export: {geometry_type}")


def geometry_to_gpkg_blob(geometry, srs_id=4326):
    header = bytearray(b"GP")
    header.append(0)
    header.append(1)
    header.extend(struct.pack("<i", int(srs_id)))
    header.extend(geometry_to_wkb(geometry))
    return bytes(header)


def create_core_tables(connection):
    connection.executescript(
        """
        PRAGMA application_id = 1196444487;
        PRAGMA user_version = 10300;
        PRAGMA foreign_keys = ON;

        CREATE TABLE gpkg_spatial_ref_sys (
          srs_name TEXT NOT NULL,
          srs_id INTEGER NOT NULL PRIMARY KEY,
          organization TEXT NOT NULL,
          organization_coordsys_id INTEGER NOT NULL,
          definition TEXT NOT NULL,
          description TEXT
        );

        CREATE TABLE gpkg_contents (
          table_name TEXT NOT NULL PRIMARY KEY,
          data_type TEXT NOT NULL,
          identifier TEXT UNIQUE,
          description TEXT DEFAULT '',
          last_change DATETIME NOT NULL,
          min_x DOUBLE,
          min_y DOUBLE,
          max_x DOUBLE,
          max_y DOUBLE,
          srs_id INTEGER,
          CONSTRAINT fk_gc_r_srs_id FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id)
        );

        CREATE TABLE gpkg_geometry_columns (
          table_name TEXT NOT NULL,
          column_name TEXT NOT NULL,
          geometry_type_name TEXT NOT NULL,
          srs_id INTEGER NOT NULL,
          z TINYINT NOT NULL,
          m TINYINT NOT NULL,
          PRIMARY KEY (table_name, column_name),
          CONSTRAINT fk_ggc_tn FOREIGN KEY (table_name) REFERENCES gpkg_contents(table_name),
          CONSTRAINT fk_ggc_srs FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id)
        );
        """
    )

    connection.executemany(
        """
        INSERT INTO gpkg_spatial_ref_sys (
          srs_name,
          srs_id,
          organization,
          organization_coordsys_id,
          definition,
          description
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        [
            ("Undefined Cartesian SRS", -1, "NONE", -1, "undefined", "undefined cartesian coordinate reference system"),
            ("Undefined geographic SRS", 0, "NONE", 0, "undefined", "undefined geographic coordinate reference system"),
            ("WGS 84 geodetic", 4326, "EPSG", 4326, WGS84_DEFINITION, "longitude/latitude coordinates in decimal degrees on the WGS 84 spheroid"),
        ],
    )


def create_layer_table(connection, layer):
    table_name = layer["table_name"]
    rows = layer["rows"]
    features = layer["geojson"]["features"]
    feature_by_id = {feature["properties"]["id"]: feature for feature in features}

    if len(feature_by_id) != len(rows):
        raise ValueError(f"{table_name}: row/feature count mismatch ({len(rows)} rows, {len(feature_by_id)} features)")

    missing = [row["id"] for row in rows if row["id"] not in feature_by_id]
    if missing:
        raise ValueError(f'{table_name}: missing geometries for ids {", ".join(missing[:10])}')

    field_names = list(rows[0].keys()) if rows else []
    field_defs = [f"{quote_identifier(name)} {infer_sql_type(rows, name)}" for name in field_names]
    columns_sql = ",\n  ".join(
        ['fid INTEGER PRIMARY KEY AUTOINCREMENT', 'geom GEOMETRY NOT NULL'] + field_defs
    )
    connection.execute(f"CREATE TABLE {quote_identifier(table_name)} (\n  {columns_sql}\n)")

    insert_columns = ["geom"] + field_names
    placeholders = ", ".join("?" for _ in insert_columns)
    quoted_columns = ", ".join(quote_identifier(column) for column in insert_columns)
    insert_sql = f"INSERT INTO {quote_identifier(table_name)} ({quoted_columns}) VALUES ({placeholders})"

    for row in rows:
        geometry = feature_by_id[row["id"]]["geometry"]
        values = [sqlite3.Binary(geometry_to_gpkg_blob(geometry))]
        values.extend(normalize_value(row.get(name)) for name in field_names)
        connection.execute(insert_sql, values)

    min_x, min_y, max_x, max_y = compute_bbox(features)
    last_change = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")

    connection.execute(
        """
        INSERT INTO gpkg_contents (
          table_name,
          data_type,
          identifier,
          description,
          last_change,
          min_x,
          min_y,
          max_x,
          max_y,
          srs_id
        ) VALUES (?, 'features', ?, ?, ?, ?, ?, ?, ?, 4326)
        """,
        (
            table_name,
            layer.get("identifier", table_name),
            layer.get("description", f"{table_name} layer"),
            last_change,
            min_x,
            min_y,
            max_x,
            max_y,
        ),
    )

    connection.execute(
        """
        INSERT INTO gpkg_geometry_columns (
          table_name,
          column_name,
          geometry_type_name,
          srs_id,
          z,
          m
        ) VALUES (?, 'geom', 'GEOMETRY', 4326, 0, 0)
        """,
        (table_name,),
    )


def main():
    parser = argparse.ArgumentParser(description="Export Turkey Map layers to a GeoPackage file.")
    parser.add_argument("--output", required=True, help="Target .gpkg path")
    args = parser.parse_args()

    payload = json.load(sys.stdin)
    layers = payload.get("layers", [])
    if not layers:
        raise SystemExit("No layers provided on stdin")

    output_path = os.path.abspath(args.output)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    if os.path.exists(output_path):
        os.remove(output_path)

    connection = sqlite3.connect(output_path)
    try:
        create_core_tables(connection)
        for layer in layers:
            create_layer_table(connection, layer)
        connection.commit()
    finally:
        connection.close()

    print(output_path)


if __name__ == "__main__":
    main()
