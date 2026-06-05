เพื่อให้สถาปัตยกรรม RAG สำหรับระบบ DMS ของคุณใช้งานได้จริงและมีประสิทธิภาพสูงสุด นี่คือ **รายละเอียดการ Implementation พร้อมตัวอย่างการตั้งค่า (Configuration)** ในแต่ละส่วน โดยอิงจากการใช้ Python เป็นหลักในการควบคุม Pipeline ครับ
## 1. Ingestion & Semantic Chunking Pipeline (Typhoon OCR + Typhoon 2.5)
ในขั้นตอนนี้ เราจะรับไฟล์เอกสาร นำเข้าสู่ OCR และส่งข้อความดิบให้ Typhoon 2.5 จัดโครงสร้างโดยใส่ <chunk> tag เพื่อนำมาตัดแบ่งเนื้อหาตามบริบทจริง
### ตัวอย่าง Prompt สำหรับ Typhoon 2.5 (รอบแรก) เพื่อใส่ Tag
```text
คุณคือผู้เชี่ยวชาญด้านการจัดการเอกสาร (DMS Editor) 
หน้าที่ของคุณคือรับข้อความดิบจากระบบ OCR แล้วนำมาจัดโครงสร้างใหม่ให้อยู่ในรูปแบบ Markdown 

เงื่อนไขสำคัญ:
1. ห้ามแก้ไข ตัดทอน หรือบิดเบือนข้อความสำคัญในเอกสาร
2. ให้วิเคราะห์เนื้อหา และแบ่งเนื้อหาออกเป็นส่วนๆ (Semantic Chunks) โดยใช้ Tag พิเศษ ครอบเนื้อหาที่เป็นเรื่องเดียวกันไว้ ดังนี้:
   <chunk topic="หัวข้อหลักของเนื้อหาใน tag นี้"> ...ข้อความ... </chunk>
3. หากมีข้อมูลสำคัญ เช่น เลขที่เอกสาร, วันที่, ชื่อบุคคล หรือเรื่อง ให้สกัดออกมาในรูปแบบของ Metadata ไว้ที่ส่วนบนสุดของเอกสารด้วยโครงสร้าง JSON ใน Tag <metadata>...</metadata>

```
### Python Implementation (การตัด Chunk จาก Tag)
```python
import re
import json

# สมมติผลลัพธ์ที่ได้มาจาก Typhoon 2.5 รอบแรก
typhoon_output = """
<metadata>
{
    "doc_number": "REQ-009",
    "date": "2026-06-05",
    "subject": "ขออนุมัติจัดซื้ออุปกรณ์เครือข่ายสำหรับโครงการ"
}
</metadata>
<chunk topic="วัตถุประสงค์และหลักการ">
เนื่องด้วยระบบเครือข่ายเดิมในสำนักงานสนามมีความเร็วไม่เพียงพอต่อการใช้งาน...
</chunk>
<chunk topic="รายการอุปกรณ์ที่ต้องการจัดซื้อ">
1. Managed Switch 24-Port 2.5GbE จำนวน 1 ตัว
2. Core Router ER7206 จำนวน 1 ตัว
</chunk>
"""

def parse_typhoon_chunks(output):
    # สกัด Metadata
    metadata_match = re.search(r'<metadata>(.*?)</metadata>', output, re.DOTALL)
    metadata = json.loads(metadata_match.group(1).strip()) if metadata_match else {}
    
    # สกัด Chunks
    chunk_pattern = r'<chunk topic="(.*?)">(.*?)</chunk>'
    chunks = re.findall(chunk_pattern, output, re.DOTALL)
    
    processed_chunks = []
    for topic, content in chunks:
        processed_chunks.append({
            "text": content.strip(),
            "metadata": {
                **metadata,
                "chunk_topic": topic
            }
        })
    return processed_chunks

chunks_to_embed = parse_typhoon_chunks(typhoon_output)

```
## 2. Vector Storage & Search Setup (BGE-M3 + Qdrant)
BGE-M3 สามารถทำ **Hybrid Search** ได้ดีมาก (Dense Vector แทนความหมายเชิงลึก + Sparse Vector แทนคำสำคัญ/Keyword) เราจะตั้งค่า Qdrant Collection ให้รองรับทั้งสองแบบเพื่อป้องกันปัญหาคำค้นหาเฉพาะ (เช่น เลขที่เอกสาร หรือรหัสพัสดุ) หลุดหาย
### ตัวอย่างการตั้งค่า Qdrant Collection (Python Client)
```python
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, SparseVectorParams, OptimizersConfigDiff

client = QdrantClient(url="http://localhost:6333")

# สร้าง Collection ที่รองรับทั้ง Dense และ Sparse (Hybrid)
client.create_collection(
    collection_name="dms_documents",
    vectors_config={
        # Dense Vector สำหรับ BGE-M3 (ขนาด 1024 มิติ)
        "bge_dense": VectorParams(
            size=1024, 
            distance=Distance.COSINE
        )
    },
    sparse_vectors_config={
        # Sparse Vector สำหรับทำ Keyword Matching จาก BGE-M3
        "bge_sparse": SparseVectorParams()
    },
    # เปิดใช้งาน Payload Index สำหรับ Metadata Filtering (เช่น ค้นหาเฉพาะเลขที่เอกสาร)
    optimizers_config=OptimizersConfigDiff(memmap_threshold=20000)
)

```
## 3. Retrieval & Re-ranking Pipeline (Qdrant Search + BGE-Reranker)
เมื่อผู้ใช้ส่งคำถามเข้ามา เราจะดึงข้อมูลแบบ Hybrid จาก Qdrant ออกมาจำนวนหนึ่ง (เช่น 15 Chunks) แล้วใช้ **BGE-Reranker** สแกนซ้ำเพื่อเลือกตัวที่ใช่ที่สุด 3-5 อันดับแรก
### Python Implementation สำหรับ Hybrid Search และ Rerank
```python
from sentence_transformers import SentenceTransformer
from transformers import AutoModelForSequenceClassification, AutoTokenizer
import torch

# 1. โหลดโมเดลสำหรับ Embedding และ Reranking
# (ในงานจริงแนะนำให้ Host เป็น API แยก เช่น Tei หรือใช้ Local Inference)
embedding_model = SentenceTransformer('BAAI/bge-m3')
rerank_tokenizer = AutoTokenizer.from_pretrained('BAAI/bge-reranker-large')
rerank_model = AutoModelForSequenceClassification.from_pretrained('BAAI/bge-reranker-large')
rerank_model.eval()

def hybrid_search_and_rerank(query, top_k_qdrant=15, top_k_final=3):
    # ก้าวที่ 1: แปลง Query เป็น Vector
    query_dense_vector = embedding_model.encode(query).tolist()
    
    # ก้าวที่ 2: ดึงข้อมูลจาก Qdrant (สมมติเรียกใช้ client.search)
    # *ในจุดนี้สามารถใส่ Filter สำหรับเจาะจงเลขเอกสารหรือวันที่ได้จาก Payload*
    qdrant_results = client.search(
        collection_name="dms_documents",
        query_vector=("bge_dense", query_dense_vector),
        limit=top_k_qdrant
    )
    
    # ก้าวที่ 3: เตรียมข้อมูลเข้า Reranker
    pairs = [[query, res.payload['text']] for res in qdrant_results]
    
    with torch.no_grad():
        inputs = rerank_tokenizer(pairs, padding=True, truncation=True, return_tensors='pt', max_length=512)
        scores = rerank_model(**inputs).logits.view(-1).tolist()
    
    # ก้าวที่ 4: ประกบคะแนนใหม่และจัดเรียงลำดับ
    reranked_results = []
    for i, res in enumerate(qdrant_results):
        reranked_results.append({
            "text": res.payload['text'],
            "metadata": res.payload['metadata'],
            "rerank_score": scores[i]
        })
        
    # เรียงจากคะแนนมากไปน้อย
    reranked_results.sort(key=lambda x: x['rerank_score'], reverse=True)
    
    # ส่งคืนเฉพาะ Top K ที่ดีที่สุดไปให้ LLM
    return reranked_results[:top_k_final]

```
## 4. Generation Pipeline (Typhoon 2.5 รอบสุดท้าย)
นำ Chunks ที่ผ่านการ Rerank มาเรียงต่อกันเป็น Context เพื่อให้ Typhoon 2.5 ตอบคำถาม โดยเน้นย้ำให้โมเดลตอบตามข้อเท็จจริงในเอกสารเท่านั้น
### ตัวอย่างการประกอบ System Prompt และ Prompt template
```text
System Prompt:
คุณคือผู้ช่วยอัจฉริยะประจำระบบจัดการเอกสาร (DMS AI Assistant) 
หน้าที่ของคุณคือตอบคำถามของผู้ใช้โดยใช้ข้อมูลจาก "Context เอกสารที่กำหนดให้" เท่านั้น 
ห้ามใช้ความรู้ภายนอกที่ไม่มีในเอกสารตอบโดยเด็ดขาด 
หากใน Context ไม่มีข้อมูลที่ตอบคำถามได้ ให้แจ้งผู้ใช้ตรงๆ ว่า "ไม่พบข้อมูลดังกล่าวในเอกสาร" 
และโปรดอ้างอิง เลขที่เอกสาร (doc_number) ทุกครั้งที่ตอบคำถามเพื่อความน่าเชื่อถือ

----------------
Context เอกสารที่ค้นพบ:
[ข้อความจาก Chunk ที่ 1] (อ้างอิง: REQ-009)
[ข้อความจาก Chunk ที่ 2] (อ้างอิง: REQ-009)

----------------
คำถามของผู้ใช้:
อุปกรณ์เครือข่ายที่ขออนุมัติจัดซื้อในเอกสาร REQ-009 มีอะไรบ้างและใช้ที่ไหน?

```
### 🛠️ คำแนะนำเพิ่มเติมสำหรับการดูแลระบบ (Ops & Infrastructure)
 1. **การลด Latency ของ Reranker:** เนื่องจาก Reranker ต้องคำนวณ Cross-Attention ทุกครั้งที่ค้นหา หากรันบน CPU อาจจะช้า (ประมาณ 1-2 วินาทีต่อการ Query) แนะนำให้รันบน **GPU** หรือเลือกใช้โมเดลย่อส่วนอย่าง bge-reranker-base เพื่อทำความเร็วให้ตอบรับกับระบบ DMS ที่มีผู้ใช้งานพร้อมกันจำนวนมาก
 2. **การทำ Document Version Control (Void & Replace):** ในระบบ DMS เมื่อเอกสารมีการแก้ไข (เช่น ออกเวอร์ชันใหม่ของ REQ-009) อย่าลืมส่ง Metadata version หรือรันคำสั่ง **Delete Points** ใน Qdrant โดยกรองจาก doc_number เก่าออกไปก่อน เพื่อไม่ให้ระบบดึงเอาข้อความจากเอกสารเวอร์ชันเก่าขึ้นมาตอบปนกับเวอร์ชันปัจจุบันครับ
 3. 