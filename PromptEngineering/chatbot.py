from rag import chat_with_doc  # Reusing your RAG function

def start_chat():
    print("Welcome to the RAG-powered Chatbot! You can ask questions about your research document.")
    print("Type 'exit' to end the chat.")
    
    while True:
        # Get the user's query (question)
        user_input = input("\nYour Question: ").strip()
        
        if user_input.lower() == "exit":
            print("Ending the chat. Goodbye!")
            break
        
        # Get the response from RAG
        try:
            response = chat_with_doc(user_input)
            print(f"\nAnswer: {response}")
        except Exception as e:
            print(f"Error: {e}. Please try again.")

if __name__ == "__main__":
    start_chat()
