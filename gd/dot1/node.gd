extends Node

# dot1 relay node (c)2026 nitrologic 
# named helpers not inline call chains

# about
# Godot Engine in use under MIT license
# Copyright (c) 2014-present Godot Engine contributors.
# Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.

const FULLSCREEN_MODES := [
	DisplayServer.WINDOW_MODE_FULLSCREEN,
	DisplayServer.WINDOW_MODE_EXCLUSIVE_FULLSCREEN,
]

func _unhandled_input(event: InputEvent) -> void:
	if is_fullscreen_toggle_event(event):
		toggle_fullscreen()
		mark_input_handled()

func is_fullscreen_toggle_event(event: InputEvent) -> bool:
	if not event is InputEventKey:
		return false
	if not event.pressed:
		return false
	if event.echo:
		return false
	return event.keycode == KEY_F12

func mark_input_handled() -> void:
	var viewport := get_viewport()
	viewport.set_input_as_handled()

func toggle_fullscreen() -> void:
	var current_mode := DisplayServer.window_get_mode()
	var next_mode := resolve_next_window_mode(current_mode)
	DisplayServer.window_set_mode(next_mode)

func resolve_next_window_mode(current_mode: int) -> int:
	if is_fullscreen_mode(current_mode):
		return DisplayServer.WINDOW_MODE_WINDOWED
	return DisplayServer.WINDOW_MODE_FULLSCREEN

func is_fullscreen_mode(mode: int) -> bool:
	return mode in FULLSCREEN_MODES


const FRAME_MAGIC := 0x4C52544E        # 'NTRL'
const FRAME_VERSION := 1
const CHUNK_JSON := 0x4E4F534A         # 'JSON'
const CHUNK_BIN  := 0x004E4942         # 'BIN\0'

func _pad4(n: int) -> int:
	return (n + 3) & ~3

func build_frame(header: Dictionary, binary: PackedByteArray) -> PackedByteArray:
	var json := JSON.stringify(header).to_utf8_buffer()
	var json_len := _pad4(json.size())
	var bin_len := _pad4(binary.size())
	var out := PackedByteArray()
	out.resize(12 + 8 + json_len + 8 + bin_len)
	out.encode_u32(0, FRAME_MAGIC)
	out.encode_u32(4, FRAME_VERSION)
	out.encode_u32(8, out.size())
	out.encode_u32(12, json_len)
	out.encode_u32(16, CHUNK_JSON)
	out.fill(0x20)
	out.encode_u32(20 + json_len, bin_len)
	out.encode_u32(24 + json_len, CHUNK_BIN)
	out.fill(0x00)
	out.encode_u32(8, out.size())
	return out

func parse_frame(data: PackedByteArray) -> Dictionary:
	if data.size() < 12 or data.decode_u32(0) != FRAME_MAGIC:
		return {}
	var header := {}
	var binary := PackedByteArray()
	var off := 12
	while off + 8 <= data.size():
		var clen := data.decode_u32(off)
		var ctype := data.decode_u32(off + 4)
		var body := data.slice(off + 8, off + 8 + clen)
		if ctype == CHUNK_JSON:
			header = JSON.parse_string(body.get_string_from_utf8())
		elif ctype == CHUNK_BIN:
			binary = body
		off += 8 + clen
	return {"header": header, "binary": binary}

# keep packets in frames dictionary
var globalBuffers: Dictionary = {}

func onBuffer(client, header: Dictionary, binary: PackedByteArray) -> void:
	var key: String = header.get("name", "")
	if key.is_empty():
		glog("onBuffer: missing name in header")
		return
	globalBuffers[key] = binary
	glog("onBuffer: stored '%s' (%d bytes)" % [key, binary.size()])

@onready var textView = TextEdit.new()

const SPLASH_DATA = [
		# Big Cross (4 lines)
		[226, 324], [516, 324],   # left
		[636, 324], [926, 324],   # right
		[576, 104], [576, 264],   # top
		[576, 384], [576, 544],   # bottom

		# Square bottom right (4 lines)
		[820, 400], [960, 400],   # top
		[960, 400], [960, 540],   # right
		[960, 540], [820, 540],   # bottom
		[820, 540], [820, 400],   # left
]

func splashScreen() -> PackedVector2Array:
		var lines := PackedVector2Array()
		for i in range(0, SPLASH_DATA.size(), 2):
				var p1 = Vector2(SPLASH_DATA[i][0], SPLASH_DATA[i][1])
				var p2 = Vector2(SPLASH_DATA[i + 1][0], SPLASH_DATA[i + 1][1])
				lines.append(p1)
				lines.append(p2)
		return lines
		
func base64_to_vec2_array(base64: String) -> PackedVector2Array:
	var bytes: PackedByteArray = Marshalls.base64_to_raw(base64)
	var result := PackedVector2Array()
	# Assumes tightly packed float32 VEC2 (8 bytes per point)
	for i in range(0, bytes.size(), 8):
		var x := bytes.decode_float(i)
		var y := bytes.decode_float(i + 4)
		result.append(Vector2(x, y))
	return result

func glog(msg: String):
	print(msg)
	textView.text+="\n[DIAG] "+msg
	textView.scroll_vertical = textView.get_line_count()

func onPacket(client, packet):
	var message = packet.get_string_from_utf8()
	var request = JSON.parse_string(message)
	if not request:
		glog("onPacket: bad request " + message)
		return
	if request.has("method"):
		var method = request["method"]
		var params = request.get("params", {})
		match method:
			"snoop":
				glog("onPacket snoop: " + message)
				var snoop = Snoop
				if (snoop):
					var schema=snoop.schema
					var json=JSON.stringify(schema)					
					glog("[SNOOP] godot schema:"+str(json.length()))
#					glog("[SNOOP] godot schema:"+json)
				else:
					glog("[SNOOP] no snoop")
			"init":
				glog("onPacket splashScreen on init: " + message)
				var vec_lines = splashScreen()
				var node2d = $Node2D
				if(node2d):
					node2d.set_lines(vec_lines)
				else:
					glog("onPacket init - missing node2D")
			"draw":
				var vec_lines = base64_to_vec2_array(params.buffer)
				var node2d = $Node2D
				if(node2d):
					node2d.set_lines(vec_lines)
					glog("onPacket draw: " + message)
				else:
					glog("onPacket draw - missing node2D")
			"tick":
				glog("onPacket tick: " + message)
			"quit":
				glog("onPacket quit: " + message)
				get_tree().quit()
			_:
				glog("onPacket: unknown method" + message)

var tcp_server = TCPServer.new()
var port = 8080
var sockets: Array[WebSocketPeer] = []

var masterSocket = WebSocketPeer.new()
var is_connected_upstream = false
var server_url = "ws://localhost:9000"

var count=0
var sumDelta=0

func _listen():
	var listen_err = tcp_server.listen(port, "*")
	if listen_err == OK:
		glog("WebSocket listening for clients on port :" + str(port))
	else:
		glog("Failed to listen on port %d. Error: %d" % [port, listen_err])
	return listen_err

func _connect():
	glog("Connecting upstream to " + server_url)
	var connect_err = masterSocket.connect_to_url(server_url)
	if connect_err != OK:
		glog("Failed to initiate upstream connection. Error: " + str(connect_err))
	return connect_err

func pollNetwork():
	masterSocket.poll()
	var master_state = masterSocket.get_ready_state()
	
	if master_state == WebSocketPeer.STATE_OPEN:
		if not is_connected_upstream:
			is_connected_upstream = true
			glog("Upstream Master connected successfully!")
			masterSocket.send_text("Hello Upstream Server!")
				
		while masterSocket.get_available_packet_count() > 0:
			var packet = masterSocket.get_packet()
			var message = packet.get_string_from_utf8()
			glog("Received from Upstream: " + message)
			
	elif master_state == WebSocketPeer.STATE_CLOSED:
		if is_connected_upstream:
			glog("Upstream Master disconnected.")
			is_connected_upstream = false

# Accept New Local Clients

	if tcp_server.is_connection_available():
		var tcp_conn = tcp_server.take_connection()
		var new_client = WebSocketPeer.new()
		if new_client.accept_stream(tcp_conn) == OK:
			sockets.append(new_client)
			glog("Accepted new local client from: " + tcp_conn.get_connected_host())

# Poll Active Local Clients

	for i in range(sockets.size() - 1, -1, -1):
		var client = sockets[i]
		client.poll()
		
		var client_state = client.get_ready_state()
		if client_state == WebSocketPeer.STATE_OPEN:
			while client.get_available_packet_count() > 0:
				var packet = client.get_packet()
				if packet.size() >= 4 and packet.decode_u32(0) == FRAME_MAGIC:
					var frame := parse_frame(packet)
					onBuffer(client, frame.header, frame.binary)
				else:
					onPacket(client,packet)
				
		elif client_state == WebSocketPeer.STATE_CLOSED:
			glog("Client [%d] disconnected. Cleaning up." % i)
			sockets.remove_at(i)
	
func _process(delta:float):
	count+=1
	sumDelta+=delta
	if count&1024==1:
		glog("1K frames:"+str(sumDelta))
	pollNetwork()

func _ready():
	textView.add_theme_stylebox_override("normal", StyleBoxEmpty.new())

	var t=Time.get_time_string_from_system()
	print("ready with normal theme time:"+t)

	textView.size = Vector2(1152, 648)
	textView.editable = false
	textView.add_theme_font_size_override("font_size", 20)
	add_child(textView)
	
	glog("startg initialized")
	glog("websocket listening on :8080")

	var error1=_listen()
	if error1 != OK:
		glog("Failed to listen, Error code: " + str(error1))

	var error2=_connect()
	if error2 != OK:
		glog("Failed to initiate connection. Error code: " + str(error2))
#		set_process(false) # Stop processing if connection handshake failed entirely
