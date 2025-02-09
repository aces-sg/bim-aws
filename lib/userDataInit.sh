#!/bin/bash

# Update package list
sudo apt-get update -y

# Install Nginx
sudo apt-get install -y nginx

# initialize sudo
sudo -i

# Configure Nginx to proxy traffic
cat > /etc/nginx/sites-available/default <<EOF
  server {
    listen 80;
    listen [::]:80;
    server_name _;

    location / {
        proxy_pass https://www.bim.com.sg;
        proxy_set_header Host www.bim.com.sg;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_ssl_server_name on;
    }

    location /_next/ {
        proxy_pass https://jobs.bimeco.io/_next/;
        proxy_set_header Host jobs.bimeco.io;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_ssl_server_name on;
    }

    location /career {
        proxy_pass https://jobs.bimeco.io;
        proxy_set_header Host jobs.bimeco.io;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_ssl_server_name on;
        proxy_redirect https://jobs.bimeco.io/career/ /jobs/;
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /health {
        access_log off;
        return 200 "Healthy";
    }

    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
EOF

# Test Nginx configuration
sudo nginx -t

# Restart Nginx to apply changes
sudo systemctl restart nginx

# Enable Nginx to start on boot
sudo systemctl enable nginx
