FROM alpine:3.20 AS mqtt-plugin

ARG MQTT_PLUGIN_VERSION=1.1.0

RUN apk add --no-cache ca-certificates curl unzip \
    && mkdir -p /opt/grafana-plugins \
    && curl -fsSL "https://github.com/grafana/mqtt-datasource/releases/download/v${MQTT_PLUGIN_VERSION}/grafana-mqtt-datasource-${MQTT_PLUGIN_VERSION}.linux_amd64.zip" \
      -o /tmp/grafana-mqtt-datasource.zip \
    && unzip -q /tmp/grafana-mqtt-datasource.zip -d /opt/grafana-plugins \
    && test -x "/opt/grafana-plugins/grafana-mqtt-datasource/gpx_mqtt_linux_amd64"

FROM grafana/grafana:12.0.0

USER root

# Keep the pinned MQTT plugin outside the persistent Grafana volume and make
# the directory writable so Grafana can also manage its bundled plugins.
RUN mkdir -p /opt/smartegg-grafana-plugins \
    && chown -R 472:0 /opt/smartegg-grafana-plugins

COPY --chown=472:0 --from=mqtt-plugin \
    /opt/grafana-plugins/grafana-mqtt-datasource \
    /opt/smartegg-grafana-plugins/grafana-mqtt-datasource

USER grafana
