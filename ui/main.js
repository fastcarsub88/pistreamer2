var browserPrefixes = ['moz', 'ms', 'o', 'webkit'];
function getBrowserPrefix() {
  for (var i = 0; i < browserPrefixes.length; i++) {
    if(browserPrefixes[i] in document) {
      return browserPrefixes[i];
    }
  }
  return null;
}
var bPrefix = getBrowserPrefix();
var hiddenPropertyName = (bPrefix ? bPrefix + 'Hidden' : 'hidden');
var visibilityEventName = (bPrefix ? bPrefix : '') + 'visibilitychange';


const streamer_ap = '/api/';

var servers_str = '';
var saved_streams = '[]';
var polling = true;
var current_status = 'init';
var currently_playing = '';

var broadcastControlBtn = document.getElementById('broadcast_control_btn');
var editBroadcastBtn = document.getElementById('edit_broadcast_btn');
var broadcastConfigElement = document.getElementById('broadcast_config_elm');
var configSubmitBtn = document.getElementById('config_submit_btn')
var currentServersDiv = document.getElementById('current_servers_div');
var localStreamsDiv = document.getElementById('local_streams_div');
var editBroadcastClose = document.getElementById('edit_broadcast_close');
var broadcastLevelRMS = document.getElementById('broadcast_level_rms');
var broadcastLevelPeak = document.getElementById('broadcast_level_peak');
var srchResultModalDiv = document.getElementById('srch_result_modal_div');
var srchResultModal = document.getElementById('srch_result_modal');
var savedStreamsDiv = document.getElementById('saved_streams_div');
var listenSrch = document.forms.srch_form;

var uIChanger = {
  st_elem: false,
  brdcst_live: function () {
    broadcastControlBtn.innerText = "Broadcasting..";
    broadcastControlBtn.classList.add('brdcst_live');
    disallow_btn('listen_tab');
  },
  brdcst_down: function () {
    broadcastControlBtn.innerText = "Go Live";
    broadcastControlBtn.classList.remove('brdcst_live');
    broadcastLevelRMS.innerText = 'N/A';
    broadcastLevelPeak.innerText = 'N/A';
    broadcastLevelRMS.style.color = 'black';
    broadcastLevelPeak.style.color = 'black';
    allow_btn('listen_tab');
  },
  streaming: function () {
    var ms = 'Streaming audio from '+currently_playing;
    var func = function () {
      send_to_server('stream_stop',false,false);
    }
    uIChanger.st_elem = q_dialog(ms,func,false,true);
  }
}
var poll = {
  polling : false,
  slow : false,
  tm_obj : false,
  poll : function () {
                      if (poll.polling){
                        if (poll.tm_obj) {clearTimeout(poll.tm_obj);}
                          var tm = (poll.slow ? 60000 : 2000);
                          poll.tm_obj = setTimeout(function () {
                            poll.tm_obj = false;
                            get_status();
                          },tm);
                      }
  }
}

function clr_brdcst_err(err_msg) {
  if (confirm('Broadcast Error: \r\n'+err_msg)) {
    var a = new FormData();
    a.append('cmd','clr_err');
    xhr(streamer_ap,a,null);
  }

}
function status_v(status,err_msg) {
  if (status != current_status) {
    if (status == 'broadcast_error') {
      clr_brdcst_err(err_msg);
      if (current_status === "broadcast") {
        uIChanger.brdcst_down()
      }
    }
    if (status == 'broadcast') {
      uIChanger.brdcst_live();
    }
    if (status == 'stream_play') {
      uIChanger.streaming();
    }
    if (status == 'idle') {
      if (current_status == 'broadcast') {
        uIChanger.brdcst_down();
      }
      if (current_status == 'stream_play' ) {
        uIChanger.st_elem.parentElement.removeChild(st_elem);
      }
    }
    current_status = status;
  }
}
function q_dialog(mess,func,func2,otr){
  var a = document.createElement('div');
  var b = document.createElement('div');
  var c = document.createElement('p');
  var d = document.createElement('button');
  var e = document.createElement('button');
  a.classList.add('modal-bckgrnd');
  b.classList.add('modal');
  c.classList.add('mdl_mess');
  d.classList.add('btn');
  e.classList.add('btn');
  e.innerText = "No";
  c.innerText = mess;
  d.onclick = function () {func(); a.parentElement.removeChild(a)};
  b.append(c);
  b.append(d);
  if (otr) {
    d.innerText = 'Stop';
  }else {
    e.onclick = function () {
      if (func2) {func2()};
      a.parentElement.removeChild(a);
    }
    d.innerText = "Yes";
    b.append(e);
  }
  a.append(b);
  document.body.append(a);
  return a;
}
function xhr(api,data,callback,auth) {
  var x = new XMLHttpRequest();
  x.onerror = function () {
    clearTimeout(resp_timer);
    xhr_error();
  }
  var resp_timer = setTimeout(function () {
    x.abort();
    xhr_error();
  },5000);
  x.onreadystatechange = function () {
    if (this.readyState === 4) {
      var res_check = this.responseText.trim()
      if (this.status === 200) {
        clearTimeout(resp_timer);
        if (callback) {
          callback(this.responseText);
        }
      }else {
        clearTimeout(resp_timer);
        xhr_error(this.status);
      }
    }
  }
  x.open("POST",api,true);
  if (auth) {
    x.setRequestHeader('Authorization',localStorage.auth_token);
  }
  x.send(data);
}
function disallow_btn(id) {
  document.getElementById(id).style.pointerEvents = 'none';
}
function allow_btn(id) {
  document.getElementById(id).style.pointerEvents = 'initial';
}
function display_audio_level(elem,num) {
  var level = num.toFixed(2);
  var color = 'grey';
  if (level > 0 ) {
    color = 'red'
  }else if (level > -10) {
    color = 'yellow'
  }else if (level > -20) {
    color = 'green'
  }
  elem.style.color = color;
  elem.innerText = level;
}
function ui_update_servers(json_str) {
  var json_obj = JSON.parse(json_str);
  currentServersDiv.innerHTML = "";
  for (var i in json_obj) {
    if (!json_obj.hasOwnProperty(i)) {continue}
    if (json_obj[i].type === 'local_raw') {
      localStreamsDiv.innerHTML = '</p><a href="rtsp://'+json_obj[i].ip+':5544">Local RTP: '+json_obj[i].ip+':4455</a></p>';
    }
    if (json_obj[i].type === 'icecast' && json_obj[i].active === 'true') {
      var host = 'http://'+json_obj[i].ip+':8000/'+json_obj[i].mount;
      currentServersDiv.innerHTML += '<p><a href="'+host+'">'+host+'</a></p>';
    }
  }
}
function ui_update_saved_streams(json_str) {
  if (json_str == '') {return}
  var json_obj = JSON.parse(json_str);
  savedStreamsDiv.innerHTML = '';
  for (var item in json_obj) {
    if (!json_obj.hasOwnProperty(item)) {continue}
    var jso = json_obj[item];
    var li = document.createElement('p');
    li.innerText = jso.full_name+', '+jso.state;
    li.stream_addr = jso.stream_addr;
    li.full_name = jso.full_name;
    li.onclick = play_stream;
    savedStreamsDiv.append(li)
  }
}
function create_input(type,value,label,name,checked) {
  var d = document.createElement('div');
  var i = document.createElement('input');
  var l = document.createElement('label');
  i.classList.add('form_input');
  l.classList.add('form_label');
  d.classList.add('frm_inpt_wrp');
  i.value = value;
  i.name = name;
  i.type = type;
  l.innerText = label;
  if (checked) {i.checked = 'checked'}
  d.append(l);
  d.append(i);
  if (type == 'checkbox') {
    i.classList.add('frm_inpt_cb');
    i.id = 'id_'+name;
    d.classList.add('chk_wpr');
    l.htmlFor = 'id_'+name;
    var s = document.createElement('span');
    s.classList.add('chbx_sp');
    d.append(s);
  }
  return d;
}
function display_config(json_str) {
  var j = JSON.parse(json_str);
  bd_edt_elm_tb.innerHTML = '';
  var di = document.createElement('div')
  for (var g in j) {
    if (j.hasOwnProperty(g)) {
      var s = j[g];
      if (s.type == 'local_raw'){
        document.getElementById('lcl_strm').value = s.ip;
        if (s.active == 'true') {
          document.getElementById('lcl_strm_actv').checked = 'checked';
        }
        continue;
      }
      var d = document.createElement('div');
      d.name = g;
      d.classList.add('frm_r');
      d.append(create_input('text',s.ip,'Host','ip',null));
      d.append(create_input('text',s.password,'Pass','password',null));
      d.append(create_input('text',s.mount,'Mount','mount',null));
      d.append(create_input('checkbox','','Enabled','active',(s.active == 'true' ? true : false)));
      bd_edt_elm_tb.append(d);
    }
  }
}
function obj_search(obj,srch_trm) {
  srch_trm = srch_trm.toLowerCase();
  var arr = [];
  for (var i = 0; i < obj.length; i++) {
    if (typeof obj[i] === 'object') {
      for (var item in obj[i]) {
        if (obj[i].hasOwnProperty(item)) {
          if (obj[i][item]) {
            var it = obj[i][item].toLowerCase();
            if (it.includes(srch_trm)) {
              if (!arr.includes(obj[i])) {
                arr.push(obj[i]);
              }
            }
          }
        }
      }
    }else {
      var it = obj[i].toLowerCase();
      if (it.indexOf(srch_trm) === 0) {
        if (arr.indexOf(obj[i]) === -1) {
          arr.push(obj[i]);
        }
      }
    }
  }
  return arr;
}
function add_to_saved_streams() {
  if (saved_streams != '') {
    var s = JSON.parse(saved_streams);
  }else {
    var s = [];
  }
  s.push(this.objData);
  var k = new FormData();
  k.append('cmd','updt_strm_list');
  k.append('json',JSON.stringify(s));
  xhr(streamer_ap,k,function () {
    srchResultModal.classList.add('dis_no');
  })
}
function play_stream() {
  var link = this.stream_addr;
  var func = function () {
    currently_playing = this.full_name;
    send_to_server('stream_play','address',link);
  }
  var ms = 'Stream audio from '+this.full_name+'?';
  q_dialog(ms,func);
}
function send_to_server(cmd,data_name,data) {
  var k = new FormData();
  k.append('cmd',cmd);
  if (data_name) {
    k.append(data_name,data);
  }
  xhr(streamer_ap,k,null,null);
}
async function get_streamer_status() {
  var request = new FormData()
  request.append('cmd','status');
  const response = await fetch(
    streamer_ap,
    {method: 'POST',body: request}
  )
  var json = await response.json();
  if (json.brdcst_conf != servers_str) {
    servers_str = json.brdcst_conf;
    ui_update_servers(servers_str)
  }
  if (json.savd_strms != saved_streams) {
    saved_streams = json.savd_strms
    ui_update_saved_streams(saved_streams)
  }
  status_v(json.status,json.error);
  if (json.status == 'broadcast') {
    display_audio_level(broadcastLevelRMS,json.level_rms[0]);
    display_audio_level(broadcastLevelPeak,json.level_peak[0]);
  }
  return true;
}
async function search_steams_list(srchTrm) {
  const strmList = await fetch('https://hawcreektech.com/streams-api/strm-list-json/').then(resp => resp.json());
  var srchRslt = obj_search(strmList,srchTrm);
  var html = document.createElement('div');
  srchRslt.forEach(
    value => {
      var a = document.createElement('p');
      a.innerText = value.full_name+' : '+value.state;
      a.objData = value;
      a.onclick = add_to_saved_streams;
      html.append(a);
    }
  )
  srchResultModal.classList.remove('dis_no');
  srchResultModalDiv.innerHTML = '';
  srchResultModalDiv.append(html);
}
function handle_poll() {
  if (document[hiddenPropertyName]) {
    poll.polling = false;
  }else {
    poll.polling = true;
    get_status()
  }
}
async function get_status() {
  await Promise.all([
    get_streamer_status()
  ])
  poll.poll();
}

broadcastControlBtn.onclick = function () {
  var cmd,mess,on_return;
  if (current_status == 'broadcast') {
    cmd = 'broadcast_stop';
    mess = "Stop streaming?";
    on_return = function (json) {
      js_obj = JSON.parse(json);
      if (js_obj.status != 'idle') {
        q_dialog(
          'Broadcast failed to shutdown: Try again?',
          function () {
            xhr(streamer_ap,data,on_return,false)
          },
          false
        );
      }else {
        uIChanger.brdcst_down();
        current_status = 'idle';
      }
    }
  }else {
    cmd = 'broadcast_start';
    mess = "Start streaming?"
    on_return = function (json) {
      js_obj = JSON.parse(json);
      if (js_obj.status != "broadcast") {
        clr_brdcst_err();
      }else {
        uIChanger.brdcst_live();
        current_status = 'broadcast';
      }
    }
  }
  var data = new FormData();
  data.append('cmd', cmd);
  q_dialog(mess,function (){xhr(streamer_ap,data,on_return,false)},false);

}
editBroadcastBtn.onclick = function () {
  broadcastConfigElement.classList.remove('dis_no');
  display_config(servers_str)
}
editBroadcastClose.onclick = function () {
  broadcastConfigElement.classList.add('dis_no');
}
configSubmitBtn.onclick = function () {
  var a = bd_edt_elm_tb.querySelectorAll('.frm_r');
  var f = {};
  var i = '';
  for (b in a){
    if (a.hasOwnProperty(b)){
      i = b;
      var c = a[b].querySelectorAll('.form_input');
      var d = {};
      for (e in c){
        if (c.hasOwnProperty(e)){
          if (c[e].name == 'active'){
            d[c[e].name] = (c[e].checked ? 'true' : 'false');
          }else {
            d[c[e].name] = c[e].value;
          }
          f[i] = d;
        }
      }
      f[i].type = 'icecast';
    }
  }
  var h = document.forms.brd_edt_frm;
  if (h.lcl_strm.value != "") {
    var g = {};
    g.type = 'local_raw';
    g.ip = h.lcl_strm.value;
    if (h.lcl_strm_actv.checked) {
      g.active = 'true';
    }else {
      g.active = 'false';
    }
    f[parseInt(i) + 1] = g;
  }
  var j = JSON.stringify(f);
  var k = new FormData();
  k.append('cmd','updt_conf');
  k.append('json',j);
  xhr(streamer_ap,k,function () {
    broadcastConfigElement.style.display = 'none';
  })
  console.log(f);
}
listenSrch.onsubmit = function (e) {
  e.preventDefault();
  search_steams_list(listenSrch.search_input.value.trim());
}

document.addEventListener(visibilityEventName, handle_poll, false);

poll.polling = true;
get_status();
