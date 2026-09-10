# 智灵官网

智灵官网是一个 Vite 静态前端项目，构建产物位于 `dist/`，可部署到任意 Linux 静态 Web 服务。

## 本地开发

```bash
cd website
npm ci
npm run dev
```

## 构建

```bash
npm run build
```

构建后可将 `dist/` 上传到 Nginx、Caddy、对象存储或 CDN。

## Docker 部署

```bash
docker build -t zhiling-website .
docker run -d --name zhiling-website -p 8080:80 --restart unless-stopped zhiling-website
```

访问 `http://服务器地址:8080`。如需绑定域名和 HTTPS，可在容器前配置 Caddy、Nginx 或云服务商负载均衡。

## 直接使用 Nginx

```bash
npm ci
npm run build
sudo mkdir -p /var/www/zhiling
sudo cp -R dist/. /var/www/zhiling/
```

将 `nginx.conf` 中的 `root` 改为 `/var/www/zhiling`，复制到服务器的 Nginx 站点配置目录后重新加载 Nginx。
