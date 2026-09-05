extends Node

@onready var log_view = TextEdit.new()

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
	log_view.text+="\n[DIAG] "+msg
	log_view.scroll_vertical = log_view.get_line_count()

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
			"init":
				glog("onPacket init: " + message)
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
					glog("onPacket draw: " + message.buffer)
				else:
					glog("onPacket draw - missing node2D")
			"tick":
				glog("onPacket tick: " + message)
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
	print("ready!"+Time.get_time_string_from_system());

	log_view.size = Vector2(1152, 648)
	log_view.editable = false
	log_view.add_theme_font_size_override("font_size", 20)
	add_child(log_view)
	
	glog("startg initialized")
	glog("websocket listening on :8080")

	var error1=_listen()
	if error1 != OK:
		glog("Failed to listen, Error code: " + str(error1))

	var error2=_connect()
	if error2 != OK:
		glog("Failed to initiate connection. Error code: " + str(error2))
#		set_process(false) # Stop processing if connection handshake failed entirely
