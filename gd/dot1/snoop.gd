extends Node

func populateCategories(all_classes: PackedStringArray, nodes: Array[String], resources: Array[String], objects: Array[String], editors: Array[String]) -> void:
	for registered_class in all_classes:
		var current_name: String = str(registered_class)

		if ClassDB.is_parent_class(current_name, "Node"):
			nodes.append(current_name)

		if ClassDB.is_parent_class(current_name, "Resource"):
			resources.append(current_name)

		if ClassDB.is_parent_class(current_name, "Object"):
			objects.append(current_name)

	nodes.sort()
	resources.sort()
	objects.sort()


func getNodeSignatures(className: String) -> Array[String]:
		var signatures: Array[String] = []
		var name = StringName(className)
		var methods: Array = ClassDB.class_get_method_list(name)
		for method in methods:
			signatures.append(method)
		signatures.sort()
		return signatures


func snoopGodot() -> Dictionary:
	var all_classes: PackedStringArray = ClassDB.get_class_list()
	var nodes: Array[String] = []
	var resources: Array[String] = []
	var objects: Array[String] = []
	var editors: Array[String] = []

	populateCategories(all_classes, nodes, resources, objects, editors)

	var version_info: Dictionary = Engine.get_version_info()
	var version_string: String = "%d.%d.%d" % [
		version_info.get("major", 0),
		version_info.get("minor", 0),
		version_info.get("patch", 0)
	]

	var schema: Dictionary = {}
	var list=ClassDB.get_class_list()
	for item in list:
		var api=ClassDB.class_get_api_type(item)
		var methods=ClassDB.class_get_method_list(item)
#		print(item,methods.size)
		var names=[]
		for method in methods:		
			var name=method["name"]
			var args=method["args"]
			var rtype=method["return"]
			var flags=method["flags"]
#			print(name,args)
			var key=item+"."+name
			names.push_back(name)
		schema[item]=names

	var result: Dictionary = {
		"name": "godot",
		"version": "0.1.0",
		"description": "Godot Engine",
		"latest": version_string,
		"copyright": "(c) 2014 Juan Linietsky, Ariel Manzur and the Godot community",
		"license": "CC BY 3.0",
		"repository": {
				"type": "git",
				"url": "https://github.com/nitrologic/biblispec"
		},
		"curator": "nitrologic",
#		"variant": get_variant_names(),
#		"globals": ["@GDScript","@GlobalScope"],
#		"node": nodes,
		"schema": schema,
#		"resource": resources,
#		"object": objects,
#		"editor": editors
	}

	return result
	
var schema:Dictionary=snoopGodot();
