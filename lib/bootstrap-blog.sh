#!/bin/bash
sudo apt-get update -y
sudo apt-get install -y nginx
cat > /etc/nginx/sites-available/default <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location /blog/_next {
        proxy_pass https://blog.bimeco.io/blog/_next;
        proxy_set_header Host blog.bimeco.io;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_ssl_server_name on;
    }

    location /blog {
        proxy_pass https://blog.bimeco.io/blog;
        proxy_set_header Host blog.bimeco.io;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_ssl_server_name on;
    }

    location /career/_next {
        proxy_pass https://jobs.bimeco.io/career/_next;
        proxy_set_header Host jobs.bimeco.io;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_ssl_server_name on;
        proxy_redirect https://jobs.bimeco.io/career/ /jobs/;
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /career {
        proxy_pass https://jobs.bimeco.io/career;
        proxy_set_header Host jobs.bimeco.io;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_ssl_server_name on;
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }

    location / {
        proxy_pass https://static.bim.com.sg;
        proxy_set_header Host static.bim.com.sg;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_ssl_server_name on;
    }

    location /health {
        access_log off;
        return 200 'Healthy';
    }

    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
EOF

sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
