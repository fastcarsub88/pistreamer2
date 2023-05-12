var onlineStreamListDiv = document.getElementById('online_stream_list_div')
var searchOnlineListInput = document.getElementById('srch_inpt')
var statusBox = document.getElementById('status_box')
var onlineStreamsList
var playrState = 'stop'
var volumeState = '100'
var volume_slider = {};
var poll = {
  polling : false,
  slow : false,
  itrvl : false,
  poll : function () {
        if (poll.polling){
          var tm = (poll.slow ? 60000 : 3000)
          poll.itrvl = setTimeout(() => {getStatus().then(poll.poll)}, tm)
        }
  },
  cancel : function () {
    window.clearTimeout(poll.itrvl)
    console.log('poll canceled ; '+poll.itrvl)
  }
}

document.getElementById('url_btn').onclick = function () {
  var url = document.getElementById('url_input').value
  startStream(url,url)
}

document.addEventListener('visibilitychange',() => {
  if (document.visibilityState == 'hidden') {
    poll.polling = false;
    clearTimeout(poll.itrvl)
  }else {
    poll.polling = true;
    poll.poll()
  }
})


function searchOnlineList(str) {
  onlineListStr = onlineStreamListDiv.innerHTML
  var div = document.createElement('div')
  onlineStreamsList.forEach((item, i) => {
    if (item.id.includes(str.toLowerCase())) {
      div.append(item)
    }
  })
  onlineStreamListDiv.innerHTML = ''
  onlineStreamListDiv.append(div)
}
function createPlayStatus(msg,btnMsg) {
  var div = document.createElement('div')
  var div2 = document.createElement('div')
  div.append(createPar(msg))
  div.append(createVol())
  div2.append(createBtn(btnMsg,pause))
  div2.append(createBtn("Stop",stop))
  div.append(div2)
  return div
}
function checkStateChange(status) {
  if (status.state != playrState) {
    playrState = status.state
    if (status.state == 'play') {
      statusBox.innerHTML = ''
      statusBox.append(createPlayStatus("Playing - "+status.name,"Pause"))
      initSliderProgress()
    }
    if (status.state == 'pause') {
      statusBox.innerHTML = ''
      statusBox.append(createPlayStatus("Paused - "+status.name,"Resume"))
      initSliderProgress()
    }
    if (status.state == 'stop') {
      statusBox.innerHTML = '<p>Status - Idle</p>'
    }
  }
  if (status.volume) {
    volume_slider.value = status.volume
    initSliderProgress()
  }
}
function createBtn(msg,func) {
  var btn = document.createElement('button')
  btn.onclick = func
  btn.innerText = msg
  btn.classList.add('btn1')
  return btn
}
function createPar(msg) {
  var p = document.createElement('p')
  p.classList.add('msg1')
  p.innerText = msg
  return p
}
function createVol(vol) {
  var slider = document.createElement('input')
  slider.type = 'range'
  slider.min = 80
  slider.max = 100
  slider.name = "volume_slider"
  slider.id = "volume_slider"
  slider.classList.add("styled-slider","slider-progress")
  slider.value = vol
  slider.onchange = function () {
    window.clearTimeout(poll.itrvl)
    window.clearTimeout(window.vol_timeout)
    window.vol_timeout = setTimeout(() => {changeVol(window.volume_slider.value).then(poll.poll)},1000)
  }
  window.volume_slider = slider
  return slider
}
function startStream(url,name) {
  poll.cancel()
  var data = new FormData()
  data.append('method','play_url')
  data.append('url',url)
  data.append('name',name)
  sendData(data).then(checkStateChange).then(poll.poll)
}
function pause() {
  poll.cancel()
  var data = new FormData()
  data.append('method','pause')
  sendData(data).then(checkStateChange).then(poll.poll)
}
function stop() {
  poll.cancel()
  var data = new FormData()
  data.append('method','stop')
  sendData(data).then(checkStateChange).then(poll.poll)
}
async function changeVol(vol) {
  var data = new FormData()
  data.append('method','change_vol')
  data.append('volume',vol)
  poll.cancel()
  sendData(data).then(checkStateChange)
}
async function buildStreamList() {
  var list = await fetch('https://hawcreektech.com/streams-api/strm-list-json/').then((r)=>{return r.json()}).catch(()=>{})
  var div = '';
  for (var i = 0; i < list.length; i++) {
    var city = list[i].city
    var full_name = list[i].full_name
    div += '<p class="btn" id="'+city.toLowerCase()+full_name.toLowerCase()+'" data-addr="'+list[i].stream_addr+'" data-name="'+full_name+'"><span class="stm-lst">'+list[i].full_name+'</span><br>'+
           '<span class="stm-lst lst-sm"">'+city+', '+list[i].state+'</span></p>';
  }
  onlineStreamListDiv.innerHTML = div;
  onlineStreamsList = onlineStreamListDiv.querySelectorAll('.btn')
  onlineStreamsList.forEach((item, i) => {
    item.onclick = function () {
      startStream(this.dataset.addr,this.dataset.name)
    }
  });

}
async function getStatus() {
  var f = new FormData();
  f.append("method","get_status");
  sendData(f).then(checkStateChange)
}
async function sendData(request) {
  return await fetch(
      window.location.href+'api',
      {method: 'POST',body: request}
    )
    .then((res) => {return res.json()})
    .catch(() => {return})
}
searchOnlineListInput.addEventListener('input',()=>{searchOnlineList(searchOnlineListInput.value)})
buildStreamList()
poll.polling = true
getStatus()
poll.poll()
function initSliderProgress() {
  for (let e of document.querySelectorAll('input[type="range"].slider-progress')) {
    e.style.setProperty('--value', e.value);
    e.style.setProperty('--min', e.min == '' ? '0' : e.min);
    e.style.setProperty('--max', e.max == '' ? '100' : e.max);
    e.addEventListener('input', () => e.style.setProperty('--value', e.value));
  }
}
