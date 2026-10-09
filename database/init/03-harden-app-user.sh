#!/bin/bash
set -eo pipefail

echo "Hardening attendance_app privileges (least privilege: SELECT, INSERT, UPDATE, DELETE)..."

# MySQL official image tự động tạo user từ MYSQL_USER với ALL PRIVILEGES trên MYSQL_DATABASE.
# Script này thu hồi quyền DDL/quản trị và chỉ cấp các thao tác dữ liệu (DML) cần thiết cho runtime.
if [ -n "$mysql" ]; then
    "${mysql[@]}" <<-EOSQL
        REVOKE ALL PRIVILEGES ON \`attendance\_db\`.* FROM '${MYSQL_USER:-attendance_app}'@'%';
        GRANT SELECT, INSERT, UPDATE, DELETE ON \`attendance\_db\`.* TO '${MYSQL_USER:-attendance_app}'@'%';
        FLUSH PRIVILEGES;
EOSQL
else
    mysql -u root -p"${MYSQL_ROOT_PASSWORD}" <<-EOSQL
        REVOKE ALL PRIVILEGES ON \`attendance\_db\`.* FROM '${MYSQL_USER:-attendance_app}'@'%';
        GRANT SELECT, INSERT, UPDATE, DELETE ON \`attendance\_db\`.* TO '${MYSQL_USER:-attendance_app}'@'%';
        FLUSH PRIVILEGES;
EOSQL
fi

echo "attendance_app privileges successfully hardened."
