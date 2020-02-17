import RPi.GPIO as gpio
import subprocess
from time import sleep
import requests

gpio.setmode(gpio.BCM)
gpio.setup(21, gpio.IN, pull_up_down=gpio.PUD_UP)

try:
    ip = subprocess.check_output("ip -4 addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}'",shell=True)
except:
    ip = subprocess.check_output("ip -4 addr show wlan0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}'",shell=True)

local_ip = ip.rstrip()
params = {"request":"put","local_ip":local_ip,"key":"nga8htHJ04Knbr933","id":"00010"}
requests.post("http://pistream.hawcreektech.com/ip_service/",data=params)

while True:
    gpio.wait_for_edge(21,gpio.FALLING)
    sleep(0.1)
    if gpio.input(21) == 0:
        subprocess.call(['sudo','shutdown','now'])
