from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
import os
import tempfile
from main import merge_ifc_files  # Ensure this is defined

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/merge")
async def merge(file1: UploadFile = File(...), file2: UploadFile = File(...)):
    with tempfile.TemporaryDirectory() as tmpdir:
        path1 = os.path.join(tmpdir, file1.filename)
        path2 = os.path.join(tmpdir, file2.filename)
        merged_path = os.path.join(tmpdir, "merged.ifc")

        # Save uploaded files to temp
        with open(path1, "wb") as f:
            f.write(await file1.read())
        with open(path2, "wb") as f:
            f.write(await file2.read())

        # Merge IFC files
        try:
            result = merge_ifc_files([path1, path2], merged_path)
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": f"Merge failed: {str(e)}"})

        # Print the merged file path (for local testing/logging)
        print(f"✅ Merged IFC file saved at: {merged_path}")

        return {
            "message": "Merge successful",
            "product_count": result.get("product_count", 0),
            "merged_path": merged_path
        }
