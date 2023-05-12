#!/bin/bash
if [[ $1 != 'install' && $1 != 'update' && $1 != 'uninstall' && $1 != 'update_html' ]]; then
  echo 'Pass "install" or "update" or "uninstall"'
  exit 1
fi
git pull
if [[ $1 == 'update_html' ]]; then
  rm -r /opt/pistream/html/*
  cp -r ui/* /opt/pistream/html/
  echo 'done'
  exit 1
fi
if [[ $1 == 'uninstall' ]]; then
  rm -r /opt/pistream
  rm /etc/nginx/sites-enabled/nginx_conf
  systemctl disable pistream
  systemctl disable pistream_extra
  echo "Remove all packages? Type 'yes' to remove all apt packages"
  read remove_apt
  if [[ $remove_apt == 'yes' ]]; then
    apt remove nginx uwsgi uwsgi-plugin-python3 python3-requests mpd python3-mpd -y
  exit
  fi
fi
if [[ $1 == 'install' ]]; then
  apt install nginx uwsgi uwsgi-plugin-python3 python3-requests mpd python3-mpd  -y
  getent passwd pistream > /dev/null
  if [[ $? -ne 0 ]]; then
    useradd pistream
  fi
  mkdir /opt/pistream
  mkdir /opt/pistream/html
  mkdir /opt/pistream/app
  mkdir /opt/pistream/service
  rm /etc/nginx/sites-enabled/default

  echo 'Enter wireguard IP: ("No" to cancel)'
  read ip
  if [[ $ip != 'No' ]]; then
    apt-get install wireguard -y
    wg genkey > /etc/wireguard/privkey
    privatekey=$(cat /etc/wireguard/privkey)
    wg pubkey < /etc/wireguard/privkey > /etc/wireguard/publickey
    echo "[Interface]
       Address = $ip
       PrivateKey = $privatekey

      [Peer]
      PublicKey = f2Y7fbMEceSH2O5hqDFuX2XvpMbOa9wFk6gnYt4wg0E=
      AllowedIPs = 10.8.1.0/24, 192.168.2.0/24
      Endpoint = vpn.hawcreektech.com:51820

      PersistentKeepalive = 60" > /etc/wireguard/wg0.conf

    systemctl enable wg-quick@wg0
    echo "wg set wg0 peer $(cat /etc/wireguard/publickey) allowed-ips $ip"
  fi
fi

if [[ $1 == 'update' ]]; then
  rm -r /opt/pistream/html/*
  rm -r /opt/pistream/app/*
fi

cp -r ui/* /opt/pistream/html/
cp -r app/* /opt/pistream/app/
cp install/nginx_conf /opt/pistream/service/
cp install/pistream.service /opt/pistream/service/
cp install/pistream_extra.service /opt/pistream/service/

if [[ $1 == 'install' ]]; then
  mpd_output='audio_output {
	type		      "alsa"
	name		      "My ALSA Device"
	device		    "hw:0,0"
	mixer_type    "software"
	mixer_device	"default"
	mixer_control	"PCM"
	mixer_index	  "0"
}'
  echo "Enter alsa or pulse?"
  read audio_device
  if [[ $audio_device == 'pulse' ]]; then
    mpd_output='audio_output {
         type            "pulse"
         name            "My PULSE Device"
}'
  fi

  mpd_config='music_directory         "/var/lib/mpd/music"
playlist_directory      "/var/lib/mpd/playlists"
db_file                 "/var/lib/mpd/mpd.db"
user                            "mpd"
bind_to_address                 "localhost"
input {
  plugin "curl"
}
decoder {
        plugin                  "hybrid_dsd"
        enabled                 "no"
}
decoder {
        plugin        "wildmidi"
        enabled       "no"
}'
  mv /etc/mpd.conf /etc/mpd.conf.bak
  echo "${mpd_config}
${mpd_output}" >> /etc/mpd.conf
  ln -s /opt/pistream/service/nginx_conf /etc/nginx/sites-enabled/
  systemctl enable /opt/pistream/service/pistream.service
  systemctl enable /opt/pistream/service/pistream_extra.service
fi
chown -R pistream:pistream /opt/pistream
nginx -s reload
systemctl daemon-reload
systemctl restart pistream
systemctl restart pistream_extra
systemctl restart mpd
echo "Done"
