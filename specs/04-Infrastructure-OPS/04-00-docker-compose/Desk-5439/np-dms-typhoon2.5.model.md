FROM scb10x/typhoon2.5-qwen3-4b:latest



PARAMETER num\_ctx 8192
PARAMETER num\_predict 4096
PARAMETER temperature 0.4

PARAMETER top\_k 40
PARAMETER top\_p 0.9
PARAMETER repeat\_penalty 1.15

