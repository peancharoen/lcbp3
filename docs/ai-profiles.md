interactive
model	np-dms-ai
temperature	0.7
top_p	0.9
max_tokens	2048
keep_alive	"5m"
num_ctx	4096
repeat_penalty 1.15

standard
model	np-dms-ai
temperature	0.5
top_p	0.8
max_tokens	4096
keep_alive	"10m"
num_ctx	8192
repeat_penalty 1.15

quality
model	np-dms-ai
temperature	0.1
top_p	0.95
max_tokens	8192
keep_alive	"10m"
num_ctx	8192
repeat_penalty 1.15

deep-analysis
model	np-dms-ai
temperature	0.3
top_p	0.85
max_tokens	8192
keep_alive	"0"
num_ctx	32768
repeat_penalty 1.15
