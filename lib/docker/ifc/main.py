import ifcpatch
import ifcopenshell
import os


def merge_ifc_files(input_files, output_path):
    if len(input_files) < 2:
        raise ValueError("At least 2 IFC files required")

    base_file_path = input_files[-1]
    ifc_file = ifcopenshell.open(base_file_path)

    ifc_file = ifcpatch.execute({
        "input": "input.ifc",
        "file": ifc_file,
        "recipe": "MergeProjects",
        "arguments": [input_files],
    })

    ifc_file.write(output_path)
    return {
        "merged_file": output_path,
        "product_count": len(ifc_file.by_type("IfcProduct")),
    }
