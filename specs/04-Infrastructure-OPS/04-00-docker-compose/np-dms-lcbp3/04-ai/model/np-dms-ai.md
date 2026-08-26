FROM scb10x/typhoon2.5-qwen3-4b:latest
PARAMETER num_ctx 8192
PARAMETER num_predict 2048
PARAMETER temperature 0.6
PARAMETER top_p 0.95
PARAMETER top_k 20
PARAMETER repeat_penalty 1.05
PARAMETER stop "<|im_start|>"
PARAMETER stop "<|im_end|>"
