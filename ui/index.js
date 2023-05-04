var onlineStreamListDiv = document.getElementById('online_stream_list_div')
var searchOnlineListInput = document.getElementById('srch_inpt')
var statusBox = document.getElementById('status_box')
var onlineStreamsList
var playrState = 'stop'
var volumeState = '100'
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
    if (item.id.includes(str)) {
      div.append(item)
    }
  })
  onlineStreamListDiv.innerHTML = div.innerHTML
}
function checkStateChange(status) {
  if (status.state != playrState) {
    playrState = status.state
    if (status.state == 'play') {
      var div = document.createElement('div')
      div.append(createPar("Playing - "+status.name))
      div.append(createVol(status.volume))
      div.append(createBtn("Pause",pause))
      div.append(createBtn("Stop",stop))
      statusBox.innerHTML = ''
      statusBox.append(div)
    }
    if (status.state == 'pause') {
      var div = document.createElement('div')
      div.append(createPar("Paused - "+status.name))
      div.append(createVol(status.volume))
      div.append(createBtn("Resume",pause))
        div.append(createBtn("Stop",stop))
      statusBox.innerHTML = ''
      statusBox.append(div)
    }
    if (status.state == 'stop') {
      statusBox.innerHTML = ''
    }
  }
  if (status.volume) {
    volume_slider.value = status.volume
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
  slider.classList.add("volume_slider")
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
