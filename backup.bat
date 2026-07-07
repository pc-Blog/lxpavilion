@echo off
title Backup

set GIT_REPO=git@github.com:pc-Blog/data.git
set BACKUP_DIR=D:\Projects\project\Blog\data-repo
set PG_CONTAINER=bg-postgres
set PG_USER=postgres
set PG_PASSWORD=123456
set PG_DATABASE=blog
set MINIO_URL=http://bg-minio:9000
set MINIO_ACCESS_KEY=minioadmin
set MINIO_SECRET_KEY=minioadmin
set MINIO_BUCKET=blog
set DOCKER_NETWORK=blog-network

echo [1/4] Sync data repo...
if exist "%BACKUP_DIR%" (
    cd /d "%BACKUP_DIR%"
    git pull
) else (
    git clone %GIT_REPO% "%BACKUP_DIR%"
)

echo [2/4] Dump PostgreSQL...
docker exec -i %PG_CONTAINER% sh -c "PGPASSWORD=%PG_PASSWORD% pg_dump -U %PG_USER% %PG_DATABASE%" > "%BACKUP_DIR%\blog.sql"

echo [3/4] Backup MinIO media...
rmdir /s /q "%BACKUP_DIR%\media" 2>/dev/null
docker run --rm --network %DOCKER_NETWORK% --entrypoint sh -v "%BACKUP_DIR%\media:/backup" quay.io/minio/mc -c "mc alias set bg %MINIO_URL% %MINIO_ACCESS_KEY% %MINIO_SECRET_KEY% 2>/dev/null && mc cp --recursive bg/%MINIO_BUCKET%/ /backup/ 2>/dev/null"

echo [4/4] Push to GitHub...
cd /d "%BACKUP_DIR%"
git add blog.sql media/
git commit -m "backup"
git push

cd /d D:\Projects\project\Blog\next
echo Done.
pause
