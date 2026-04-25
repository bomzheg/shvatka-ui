FROM node:20.11.0 as build
WORKDIR /usr/local/app

# Install dependencies in a separate layer to maximize Docker build cache reuse.
COPY package.json package-lock.json ./
RUN npm ci

# Copy application source and build.
COPY . .
RUN npm run build


FROM nginx:latest
COPY --from=build /usr/local/app/dist/shvatka/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["/bin/sh", "-c", "envsubst < /usr/share/nginx/html/assets/env.template.js > /usr/share/nginx/html/assets/env.js && exec nginx -g 'daemon off;'"]
