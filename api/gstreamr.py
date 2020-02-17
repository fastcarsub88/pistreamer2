import gi,threading
gi.require_version('Gst','1.0')
from gi.repository import Gst
import json
from time import sleep
Gst.init(None)
class Gstmr:
    def __init__(self):
        self.error_msg = ""
        self.status = "NULL"
        self.config = ''
        self.do_quit = False
        self.level_rms = ''
        self.level_peak = ''
    def start(self):
        print 'Gstrmr starting'
        self.error = False
        self.error_msg = ""
        src = Gst.ElementFactory.make("alsasrc")
        volel = Gst.ElementFactory.make("volume")
        level = Gst.ElementFactory.make("level")
        stee = Gst.ElementFactory.make("tee")
        squeue = Gst.ElementFactory.make("queue")
        tee = Gst.ElementFactory.make("tee")
        adiocnvrt = Gst.ElementFactory.make("audioconvert")
        lam3enc = Gst.ElementFactory.make("lamemp3enc")
        volel.set_property("volume",2)
        self.pipeln = Gst.Pipeline()
        self.pipeln.add(src)
        self.pipeln.add(volel)
        self.pipeln.add(level)
        self.pipeln.add(stee)
        self.pipeln.add(squeue)
        self.pipeln.add(adiocnvrt)
        self.pipeln.add(lam3enc)
        self.pipeln.add(tee)
        src.link(volel)
        volel.link(stee)
        stee.link(squeue)
        squeue.link(level)
        level.link(adiocnvrt)
        adiocnvrt.link(lam3enc)
        lam3enc.link(tee)
        c_obj = json.loads(self.config)
        for j in c_obj:
            if c_obj[j]['active'] != "true":
                continue
            queue = Gst.ElementFactory.make('queue')
            self.pipeln.add(queue)
            if c_obj[j]['type'] == "icecast":
                sh2sd = Gst.ElementFactory.make("shout2send")
                self.pipeln.add(sh2sd)
                sh2sd.set_property("mount",c_obj[j]['mount'])
                sh2sd.set_property("password",c_obj[j]['password'])
                sh2sd.set_property("ip",c_obj[j]['ip'])
                queue.link(sh2sd)
                tee.link(queue)
            elif c_obj[j]['type'] == 'local_raw':
                el1 = Gst.ElementFactory.make("audioresample")
                self.pipeln.add(el1)
                el2 = Gst.ElementFactory.make("audioconvert")
                self.pipeln.add(el2)
                el3 = Gst.ElementFactory.make("rtpL16pay")
                self.pipeln.add(el3)
                el4 = Gst.ElementFactory.make("udpsink")
                el4.set_property("host",c_obj[j]["ip"])
                el4.set_property("port",4455)
                self.pipeln.add(el4)
                stee.link(queue)
                queue.link(el1)
                el1.link(el2)
                el2.link(el3)
                el3.link_filtered(el4,Gst.caps_from_string("application/x-rtp, pt=10, encoding-name=L16, payload=10, clock-rate=44100, channels=2 "))
        self.pipeln.set_state(Gst.State.PLAYING)
        self.playing = threading.Thread(target=self.play_f)
        self.status = "Starting"
        self.playing.start()
        while True:
            sleep(0.1)
            ret = ''
            if self.status == 'PLAYING':
                ret = "PLAYING"
                print "Started!!!"
                break
            elif self.error:
                ret = 'ERROR : '+self.error_msg
                break
        return ret
    def stop(self):
        print 'Gstmr stopping'
        self.do_quit = True
    def status(self):
        try:
            r = self.pipeln.get_state(5)
            return True if r[1] == Gst.State.PLAYING else False
        except AttributeError:
            return False
    def play_f(self):
        try:
            bus = self.pipeln.get_bus()
            while True:
                if self.do_quit:
                    self.do_quit = False
                    break
                msg = bus.timed_pop_filtered(
                100 * Gst.MSECOND,
                (Gst.MessageType.ERROR |
                Gst.MessageType.STATE_CHANGED |
                Gst.MessageType.WARNING |
                Gst.MessageType.ELEMENT))
                if msg:
                    if msg.type == Gst.MessageType.ELEMENT:
                        msg_struct = msg.get_structure()
                        if msg_struct.get_name() == 'level':
                            self.level_rms = msg_struct.get_value('rms')
                            self.level_peak = msg_struct.get_value('peak')
                    elif msg.type == Gst.MessageType.STATE_CHANGED:
                        o_st,n_st,p_st = msg.parse_state_changed()
                        self.status = Gst.Element.state_get_name(n_st)
                        print 'State change :'+self.status
                    elif msg.type == Gst.MessageType.WARNING:
                        err, dbg = msg.parse_warning()
                        if dbg:
                            self.error_msg = dbg
                        print 'Warning :'+err.message+' : '+dbg
                    else:
                        self.do_quit = True
                        self.error = True
                        if msg.type == Gst.MessageType.ERROR:
                            err,dbg = msg.parse_error()
                        if dbg:
                            self.error_msg = dbg
                        print 'Error :'+err.message+' : '+dbg
        finally:
            self.status = 'NULL'
            print 'Gstmr shutdown'
            self.pipeln.set_state(Gst.State.NULL)

class Playr:
    def __init__(self):
        self.playbin = Gst.ElementFactory.make("playbin")
        self.sink = Gst.ElementFactory.make('autoaudiosink')
        self.playbin.set_property('audio-sink',self.sink)
        self.status = "NULL"
        self.error_msg = ''
        self.error = False
        self.do_quit = False
    def start(self, uri):
        if self.status != 'NULL':
            return False
        self.playbin.set_property("uri",uri)
        self.playbin.set_state(Gst.State.PLAYING)
        self.playing = threading.Thread(target=self.play_f)
        self.status = "Starting"
        self.playing.start()
        while True:
            sleep(0.1)
            ret = ''
            if self.status == 'PLAYING':
                ret = "PLAYING"
                break
            elif self.error:
                ret = 'ERROR : '+self.error_msg
                break
        return ret
    def stop(self):
        print 'stop'
        self.do_quit = True
    def play_f(self):
        try:
            bus = self.playbin.get_bus()
            while True:
                if self.do_quit:
                    self.do_quit = False
                    break
                msg = bus.timed_pop_filtered(
                100 * Gst.MSECOND,
                 (Gst.MessageType.EOS |
                  Gst.MessageType.ERROR |
                  Gst.MessageType.STATE_CHANGED |
                  Gst.MessageType.WARNING))
                if msg:
                    if msg.type == Gst.MessageType.STATE_CHANGED:
                        o_st,n_st,p_st = msg.parse_state_changed()
                        if msg.src == self.playbin:
                            self.status = Gst.Element.state_get_name(n_st)
                    else:
                        if msg.type == Gst.MessageType.WARNING:
                            err, dbg = msg.parse_warning()
                            self.error = True
                            print dbg + " :::error"
                        elif msg.type == Gst.MessageType.ERROR:
                            err,dbg = msg.parse_error()
                            self.error = True
                            self.do_quit = True
                        if dbg:
                            self.error_msg = dbg
        finally:
            self.status = 'NULL'
            self.playbin.set_state(Gst.State.NULL)
