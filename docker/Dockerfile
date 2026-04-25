# IBN-5100 Terminal — production image
# 單階段：以 nginx:alpine 靜態 serve `web/`。
FROM nginx:alpine

# 將整個 web/ 目錄拷入 Nginx 預設靜態根。
COPY web/ /usr/share/nginx/html/

# 公開預設 HTTP port；外部 host 透過 docker-compose 對應到 8080。
EXPOSE 80

# 不自訂 CMD —— 沿用 base image 的 nginx daemon 啟動。
