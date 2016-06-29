FROM node:6.2.2

MAINTAINER Julien Blanc <jbla@tuta.io>

EXPOSE 8080

WORKDIR /manada-client

COPY . /manada-client

RUN npm install argparse \
&& npm install async \
&& npm install basic-auth \
&& npm install body-parser \
&& npm install event-timer \
&& npm install express \
&& npm install express-session \
&& npm install helmet \
&& npm install node-rest-client \
&& npm install pug

ENTRYPOINT ["node", "manadaclt.js", "-c"]
CMD ["manada"]

