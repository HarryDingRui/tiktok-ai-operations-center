FROM nginx:alpine

WORKDIR /usr/share/nginx/html

# This repository is a plain static site: there is no package manifest or
# production build step, so the runtime image only needs Nginx and the site
# files. Keeping the source tree out of the image also keeps the container
# independent from the Node tooling used by the optional gateway service.
RUN rm -rf /usr/share/nginx/html/*

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy only the browser-delivered artifact. The repository also contains the
# optional Node gateway, tests, and maintenance scripts, none of which belong
# in the static Nginx runtime image.
COPY index.html login.html login.css login.js .nojekyll /usr/share/nginx/html/
COPY data /usr/share/nginx/html/data
COPY vendor /usr/share/nginx/html/vendor

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/healthz || exit 1
