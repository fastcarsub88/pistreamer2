var onlineStreamListDiv = document.getElementById('online_stream_list_div')
var searchOnlineListInput = document.getElementById('srch_inpt')
async function buildStreamList() {
  var list = await fetch('https://hawcreektech.com/streams-api/strm-list-json/').then((r)=>{return r.json()}).catch(()=>{})
  var div = '';
  for (var i = 0; i < list.length; i++) {
    var city = list[i].city
    var full_name = list[i].full_name
    div += '<p class="btn" id="'+city+full_name+'" ldata-addr="'+list[i].stream_addr+'" data-lname="'+full_name+'"><span class="stm-lst">'+list[i].full_name+'</span><br>'+
           '<span class="stm-lst lst-sm"">'+city+', '+list[i].state+'</span></p>';
  }
  document.getElementById('online_stream_list_div').innerHTML = div;
}

function searchOnlineList(str) {
  var div = ''
  document.querySelectorAll('.btn').forEach((item, i) => {
    if (item.id.includes(str)) {
      div += item.innerHTML
    }
  });
  onlineStreamListDiv.innerHTML = div
}
searchOnlineListInput.onkeyup = function () {
  searchOnlineList(searchOnlineListInput.value)
}
buildStreamList()
