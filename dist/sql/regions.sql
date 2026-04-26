CREATE TABLE "regions" (
  "id" TEXT,
  "level" TEXT,
  "parent_id" TEXT,
  "name" TEXT,
  "name_ascii" TEXT,
  "slug" TEXT,
  "region_kind" TEXT,
  "source_hdx_id" TEXT,
  "centroid_lat" TEXT,
  "centroid_lon" TEXT,
  "bbox_min_lon" TEXT,
  "bbox_min_lat" TEXT,
  "bbox_max_lon" TEXT,
  "bbox_max_lat" TEXT,
  "aliases" TEXT,
  "member_ids" TEXT,
  "x" TEXT,
  "y" TEXT,
  "coordinate_system" TEXT
);
INSERT INTO "regions" ("id", "level", "parent_id", "name", "name_ascii", "slug", "region_kind", "source_hdx_id", "centroid_lat", "centroid_lon", "bbox_min_lon", "bbox_min_lat", "bbox_max_lon", "bbox_max_lat", "aliases", "member_ids", "x", "y", "coordinate_system") VALUES ('TR-R-AKD', 'region', NULL, 'Akdeniz', 'akdeniz', 'akdeniz', 'geographic-7', 'GEOGRAPHIC7:TR-R-AKD', 37.23253862125, 33.8592656475, 29.26727949, 35.80883453, 37.75252722, 38.60984608, '[]', '["TR-P-01","TR-P-07","TR-P-15","TR-P-31","TR-P-32","TR-P-33","TR-P-46","TR-P-80"]', 33.8592656475, 37.23253862125, 'EPSG:4326');
INSERT INTO "regions" ("id", "level", "parent_id", "name", "name_ascii", "slug", "region_kind", "source_hdx_id", "centroid_lat", "centroid_lon", "bbox_min_lon", "bbox_min_lat", "bbox_max_lon", "bbox_max_lat", "aliases", "member_ids", "x", "y", "coordinate_system") VALUES ('TR-R-DOA', 'region', NULL, 'Doğu Anadolu', 'dogu anadolu', 'dogu-anadolu', 'geographic-7', 'GEOGRAPHIC7:TR-R-DOA', 39.24609254928572, 41.70580211, 37.26435661, 36.96450671, 44.8178336, 41.60082189, '[]', '["TR-P-04","TR-P-12","TR-P-13","TR-P-23","TR-P-24","TR-P-25","TR-P-30","TR-P-36","TR-P-44","TR-P-49","TR-P-62","TR-P-65","TR-P-75","TR-P-76"]', 41.70580211, 39.24609254928572, 'EPSG:4326');
INSERT INTO "regions" ("id", "level", "parent_id", "name", "name_ascii", "slug", "region_kind", "source_hdx_id", "centroid_lat", "centroid_lon", "bbox_min_lon", "bbox_min_lat", "bbox_max_lon", "bbox_max_lat", "aliases", "member_ids", "x", "y", "coordinate_system") VALUES ('TR-R-EGE', 'region', NULL, 'Ege', 'ege', 'ege', 'geographic-7', 'GEOGRAPHIC7:TR-R-EGE', 38.2636271625, 28.852007625, 26.19409509, 36.29219042, 31.73209817, 39.8749105, '[]', '["TR-P-03","TR-P-09","TR-P-20","TR-P-35","TR-P-43","TR-P-45","TR-P-48","TR-P-64"]', 28.852007625, 38.2636271625, 'EPSG:4326');
INSERT INTO "regions" ("id", "level", "parent_id", "name", "name_ascii", "slug", "region_kind", "source_hdx_id", "centroid_lat", "centroid_lon", "bbox_min_lon", "bbox_min_lat", "bbox_max_lon", "bbox_max_lat", "aliases", "member_ids", "x", "y", "coordinate_system") VALUES ('TR-R-GDA', 'region', NULL, 'Güneydoğu Anadolu', 'guneydogu anadolu', 'guneydogu-anadolu', 'geographic-7', 'GEOGRAPHIC7:TR-R-GDA', 37.54801628222222, 39.88765786888889, 36.44796013, 36.63205995, 43.502063, 38.74345173, '[]', '["TR-P-02","TR-P-21","TR-P-27","TR-P-47","TR-P-56","TR-P-63","TR-P-72","TR-P-73","TR-P-79"]', 39.88765786888889, 37.54801628222222, 'EPSG:4326');
INSERT INTO "regions" ("id", "level", "parent_id", "name", "name_ascii", "slug", "region_kind", "source_hdx_id", "centroid_lat", "centroid_lon", "bbox_min_lon", "bbox_min_lat", "bbox_max_lon", "bbox_max_lat", "aliases", "member_ids", "x", "y", "coordinate_system") VALUES ('TR-R-ICA', 'region', NULL, 'İç Anadolu', 'ic anadolu', 'ic-anadolu', 'geographic-7', 'GEOGRAPHIC7:TR-R-ICA', 39.007756224615385, 34.016223169999996, 29.97818426, 36.43588177, 38.77150834, 41.09618141, '[]', '["TR-P-06","TR-P-18","TR-P-26","TR-P-38","TR-P-40","TR-P-42","TR-P-50","TR-P-51","TR-P-58","TR-P-66","TR-P-68","TR-P-70","TR-P-71"]', 34.016223169999996, 39.007756224615385, 'EPSG:4326');
INSERT INTO "regions" ("id", "level", "parent_id", "name", "name_ascii", "slug", "region_kind", "source_hdx_id", "centroid_lat", "centroid_lon", "bbox_min_lon", "bbox_min_lat", "bbox_max_lon", "bbox_max_lat", "aliases", "member_ids", "x", "y", "coordinate_system") VALUES ('TR-R-KAR', 'region', NULL, 'Karadeniz', 'karadeniz', 'karadeniz', 'geographic-7', 'GEOGRAPHIC7:TR-R-KAR', 40.90319807, 36.083300725555546, 30.562463, 39.85699096, 42.61297261, 42.09780256, '[]', '["TR-P-05","TR-P-08","TR-P-14","TR-P-19","TR-P-28","TR-P-29","TR-P-37","TR-P-52","TR-P-53","TR-P-55","TR-P-57","TR-P-60","TR-P-61","TR-P-67","TR-P-69","TR-P-74","TR-P-78","TR-P-81"]', 36.083300725555546, 40.90319807, 'EPSG:4326');
INSERT INTO "regions" ("id", "level", "parent_id", "name", "name_ascii", "slug", "region_kind", "source_hdx_id", "centroid_lat", "centroid_lon", "bbox_min_lon", "bbox_min_lat", "bbox_max_lon", "bbox_max_lat", "aliases", "member_ids", "x", "y", "coordinate_system") VALUES ('TR-R-MAR', 'region', NULL, 'Marmara', 'marmara', 'marmara', 'geographic-7', 'GEOGRAPHIC7:TR-R-MAR', 40.69014389090909, 28.49714086545454, 25.6655581, 39.07055886, 31.01240447, 42.1047872, '[]', '["TR-P-10","TR-P-11","TR-P-16","TR-P-17","TR-P-22","TR-P-34","TR-P-39","TR-P-41","TR-P-54","TR-P-59","TR-P-77"]', 28.49714086545454, 40.69014389090909, 'EPSG:4326');
