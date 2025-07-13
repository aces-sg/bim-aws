from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import os
import tempfile
import boto3
import uuid
from main import merge_ifc_files  # Ensure this function exists

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/merge")
async def merge(files: list[UploadFile] = File(...)):
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="At least 2 IFC files are required for merging.")

    with tempfile.TemporaryDirectory() as tmpdir:
        local_paths = []

        # Save uploaded files to temporary local paths
        for file in files:
            file_path = os.path.join(tmpdir, file.filename)
            with open(file_path, "wb") as f:
                f.write(await file.read())
            local_paths.append(file_path)

        merged_path = os.path.join(tmpdir, "merged.ifc")

        # Merge IFC files
        try:
            result = merge_ifc_files(local_paths, merged_path)
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": f"Merge failed: {str(e)}"})

        # Prepare S3 upload
        BUCKET_NAME = os.environ.get("BUCKET_NAME")
        if not BUCKET_NAME:
            return JSONResponse(status_code=500, content={"error": "BUCKET_NAME is not set in environment"})

        unique_id = str(uuid.uuid4())
        s3_key = f"uploads/merged/{unique_id}.ifc"

        s3 = boto3.client("s3")
        try:
            s3.upload_file(merged_path, BUCKET_NAME, s3_key)
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": f"Failed to upload to S3: {str(e)}"})

        return {
            "message": "Merge and upload successful",
            "product_count": result.get("product_count", 0),
            "s3_key": s3_key,
            "bucket_name": BUCKET_NAME
        }
