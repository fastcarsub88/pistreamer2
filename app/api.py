import cgi,json,time

def get_status(arg):
    with open('status.json') as f:
        return f.read()

def get_favorites():
    with open('favorites.json') as s:
        return s.read()

def pistream_cmd(post):
    cmd = post.getvalue('cmd');
    if cmd == 'status':
        return get_status()
    if cmd == 'clr_err':
        status = get_status()
        status['error'] = ''
        with open('status.json','w') as f:
            f.write(status)
            return return_wrpr(['SUCCESS','idle',status])
    if cmd == 'get_conf':
        with open('/var/www/pistreamer/api/broadcastconf.json') as trg:
            return trg.read()
    if cmd == 'updt_conf' and 'json' in post:
        with open('/var/www/pistreamer/api/broadcastconf.json','w') as trg:
            trg.write(post.getvalue('json'))
        load_streamer_config()
        return '{"Response":"OK"}'
    if cmd == 'updt_strm_list' and 'json' in post:
        with open('/var/www/pistreamer/api/saved_streams.json','w') as trg:
            trg.write(post.getvalue('json'))
        update_saved_streams()
        return '{"Response":"OK"}'
    if cmd == 'broadcast_start':
        gst.start()
        time.sleep(1)
        return stcheck_wrpr(False)
    if cmd == 'broadcast_stop':
        gst.stop()
        time.sleep(1)
        return stcheck_wrpr(False)
    if cmd == 'stream_play' and 'address' in post:
        addr = post.getvalue('address')
        if addr.startswith('http://') or addr.startswith('https://'):
            plyr.start(post.getvalue('address'))
            stream_name = post.getvalue('name')
            return stcheck_wrpr(False)
    if cmd == 'stream_stop':
        plyr.stop()
        return stcheck_wrpr(False)
    return stcheck_wrpr(['ERROR','error','Unrecognized Command or Improper URL'])

def application(env, start_response):
    name = ''
    if env['REQUEST_METHOD'] == 'POST':
        post_env = env.copy()
        post_env['QUERY_STRING'] = ''
        post = cgi.FieldStorage(
            fp=env['wsgi.input'],
            environ=post_env,
            keep_blank_values=True
        )
        rtvl = pistream_cmd(post)
        if rtvl:
            response = '200 OK'
            name = rtvl
        else:
            response = '401 Invalid'
    elif env['REQUEST_METHOD'] == 'GET':
        response = '200 OK'
        name = stcheck_wrpr(False);
    start_response(response,[('Content-Type','text/html'),('Access-Control-Allow-Origin','*')])
    return [name]

load_streamer_config()
update_saved_streams()
