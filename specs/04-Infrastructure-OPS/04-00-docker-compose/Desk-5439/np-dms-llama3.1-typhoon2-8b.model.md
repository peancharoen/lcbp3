FROM scb10x/llama3.1-typhoon2-8b-instruct:latest

PARAMETER num_ctx 8192
PARAMETER num_predict 4096
PARAMETER temperature 0.4
PARAMETER top_k 40
PARAMETER top_p 0.9
PARAMETER repeat_penalty 1.15



