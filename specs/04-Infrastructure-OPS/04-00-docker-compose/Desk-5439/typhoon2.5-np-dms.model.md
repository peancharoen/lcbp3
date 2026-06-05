FROM scb10x/typhoon2.5-qwen3-4b:latest

PARAMETER num_ctx 8192
PARAMETER num_predict 4096
PARAMETER temperature 0.1
PARAMETER top_p 0.85
PARAMETER repeat_penalty 1.15
