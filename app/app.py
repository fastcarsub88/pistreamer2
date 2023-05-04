import json,cgi
from mpd import MPDClient
client = MPDClient()
client.timeout = 10
client.idletimeout = None
client.disconnect()

song_name = ''

def play_song(url,name):
    global song_name
    client.connect("localhost", 6600)
    client.clear()
    client.add(url)
    client.play(0)
    status = client.status()
    client.close()
    client.disconnect()
    with open('current_song','w') as f:
        f.write(name)
    song_name = name
    if status['state'] == 'play':
        status['name'] = name
    return json.dumps(status)

def pause():
    client.connect('localhost',6600)
    client.pause()
    status = client.status()
    client.close()
    client.disconnect()
    status['name'] = get_song_name()
    return json.dumps(status)

def stop():
    client.connect('localhost',6600)
    client.stop()
    status = client.status()
    client.close()
    client.disconnect()
    return json.dumps(status)

def change_vol(vol):
    client.connect('localhost',6600)
    client.setvol(vol)
    status = client.status()
    client.close()
    client.disconnect()
    status['name'] = get_song_name()
    return json.dumps(status)

def get_song_name():
    global song_name
    if song_name == '':
        print('read song name')
        with open('current_song') as f:
            song_name = f.read()
    return song_name

def get_status():
    client.connect("localhost", 6600)
    status = client.status()
    if status['state'] == 'play' or status['state'] == 'pause':
        status['name'] = get_song_name()
    client.close()
    client.disconnect()
    return json.dumps(status)

def func_caller(post):
    if "method" not in post:
        return '{"response":"error","error":"no method"}'
    method = post.getvalue('method')
    try:
        if method == 'get_status':
            return get_status()
        if method == 'play_url':
            url = post.getvalue('url')
            name = post.getvalue('name')
            return play_song(url,name)
        if method == 'pause':
            return pause()
        if method == 'stop':
            return stop()
        if method == 'change_vol':
            vol = post.getvalue('volume')
            return change_vol(vol)
        return '{"response":"error","error": "method not understood"}'
    except Exception as e:
        return '{"response":"error","error":"Exception: '+repr(e)+'"}'


def application(env, start_response):
    if env['REQUEST_METHOD'] == 'POST':
        post_env = env.copy()
        post_env['QUERY_STRING'] = ''
        post = cgi.FieldStorage(
            fp=env['wsgi.input'],
            environ=post_env,
            keep_blank_values=True
        )
        response = func_caller(post)
    else:
        response = '{"error":"not allowed"}'
    start_response('200',[('Content-Type','text/html'),('Access-Control-Allow-Origin','*')])
    return[response.encode('utf_8')]
