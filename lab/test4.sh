curl "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ALIBABA_API_KEY" \
    -d "{\"model\": \"mindlab/macaron-v1.1-venti-pro\",\"messages\": [{\"role\": \"user\", \"content\": \"What is the date\"}]}"
