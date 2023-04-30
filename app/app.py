import cgi,json,time,gi,threading
from datetime import datetime
from math import ceil

gi.require_version('Gst','1.0')
from gi.repository import Gst
import gstreamr

stream_name = ''
savd_strms = ''

gst = gstreamr.Gstmr();
plyr = gstreamr.Playr();

def load_streamer_config():
    with open('broadcastconf.json') as f:
        gst.config = f.read()

def update_saved_streams():
    global savd_strms
    with open('saved_streams.json') as s:
        savd_strms = s.read()
    print savd_strms

def stcheck():
    if gst.status != 'NULL':
        if plyr.status != 'NULL':
            return ['ERROR','error','stream in/out']
        if gst.error:
            return ['ERROR','broadcast_error',gst.error_msg]
        return ['SUCCESS','broadcast',gst.status,gst.level_rms,gst.level_peak]
    if plyr.status != 'NULL':
        if plyr.error:
            return ['ERROR','stream_error',plyr.error_msg]
        return ['SUCCESS','stream_play',plyr.status]
    return ['SUCCESS','idle','idle']

def stcheck_wrpr(stat):
    if not stat:
        stat = stcheck()
    stat_return = {}
    stat_return['status'] = stat[1]
    stat_return['brdcst_conf'] = gst.config
    stat_return['savd_strms'] = savd_strms
    stat_return['raw_data'] = stat[2]
    stat_return['model'] = 'flatmax'
    stat_return['name'] = stream_name
    if stat[1] == 'broadcast':
        stat_return['level_rms'] = stat[3]
        stat_return['level_peak'] = stat[4]
    return json.dumps(stat_return)

def pistream_cmd(post):
    cmd = post.getvalue('cmd');
    global stream_name
    a = 'OK'
    if cmd == 'status':
        return stcheck_wrpr(False)
    if cmd == 'clr_err':
        gst.status = 'NULL'
        gst.error_msg = ''
        return stcheck_wrpr(['SUCCESS','idle',gst.status])
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
