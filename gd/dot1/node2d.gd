extends Node2D

var lines: PackedVector2Array = PackedVector2Array()

func set_lines(new_lines: PackedVector2Array) -> void:
	lines = new_lines
	queue_redraw()

func _draw() -> void:
	for i in range(0, lines.size(), 2):
		var start := lines[i]
		var end   := lines[i + 1]
		draw_line(start, end, Color.WHITE, 1.0)

# Called when the node enters the scene tree for the first time.
func _ready() -> void:
	pass # Replace with function body.


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta: float) -> void:
	pass
