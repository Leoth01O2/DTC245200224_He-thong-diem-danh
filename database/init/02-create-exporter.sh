#!/bin/bash
set -eo pipefail

# Fail-fast nếu thiếu biến môi trường MYSQL_EXPORTER_PASSWORD
if [ -z "$MYSQL_EXPORTER_PASSWORD" ]; then
    echo "ERROR: MYSQL_EXPORTER_PASSWORD environment variable is required for exporter initialization" >&2
    exit 1
fi

echo "Initializing attendance_exporter user for Prometheus monitoring..."

# Khởi tạo user attendance_exporter với mật khẩu từ biến môi trường
if [ -n "$mysql" ]; then
    "${mysql[@]}" <<-EOSQL
        CREATE USER IF NOT EXISTS 'attendance_exporter'@'%' IDENTIFIED BY '${MYSQL_EXPORTER_PASSWORD}' WITH MAX_USER_CONNECTIONS 3;
        GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO 'attendance_exporter'@'%';
        FLUSH PRIVILEGES;
EOSQL
else
    mysql -u root -p"${MYSQL_ROOT_PASSWORD}" <<-EOSQL
        CREATE USER IF NOT EXISTS 'attendance_exporter'@'%' IDENTIFIED BY '${MYSQL_EXPORTER_PASSWORD}' WITH MAX_USER_CONNECTIONS 3;
        GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO 'attendance_exporter'@'%';
        FLUSH PRIVILEGES;
EOSQL
fi

echo "attendance_exporter user initialization complete."
