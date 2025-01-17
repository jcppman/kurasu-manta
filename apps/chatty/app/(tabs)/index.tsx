import QuizCard from '@/components/QuizCard'
import { generateAPIUrl } from '@/utils/url'
import { useChat } from '@ai-sdk/react'
import { fetch as expoFetch } from 'expo/fetch'
import { SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'

export default function App() {
  const { messages, error, handleInputChange, input, handleSubmit } = useChat({
    fetch: expoFetch as unknown as typeof globalThis.fetch,
    api: generateAPIUrl('/chat'),
    onError: (error) => {
      console.error(error.message)
    },
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === 'showQuiz') {
        return 'shown'
      }
    },
  })

  if (error) return <Text>{error.message}</Text>

  return (
    <SafeAreaView style={{ height: '100%' }}>
      <View
        style={{
          height: '95%',
          display: 'flex',
          flexDirection: 'column',
          paddingHorizontal: 8,
        }}
      >
        <ScrollView style={{ flex: 1 }}>
          {messages.map((m) => (
            <View key={m.id} style={{ marginVertical: 8 }}>
              <View>
                <Text style={{ fontWeight: 700 }}>{m.role}</Text>
                <Text>{m.content}</Text>
                {m.toolInvocations?.map((tool) => {
                  const { toolCallId, toolName, args } = tool
                  switch (toolName) {
                    case 'showQuiz':
                      return <QuizCard key={toolCallId} quiz={args} />
                    default:
                      return (
                        <Text key={toolCallId}>
                          Name: {toolName}, Result: {JSON.stringify(args)}
                        </Text>
                      )
                  }
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={{ marginTop: 8 }}>
          <TextInput
            style={{ backgroundColor: 'white', padding: 8 }}
            placeholder="Say something..."
            value={input}
            onChange={(e) =>
              handleInputChange({
                ...e,
                target: {
                  ...e.target,
                  value: e.nativeEvent.text,
                },
              } as unknown as React.ChangeEvent<HTMLInputElement>)
            }
            onSubmitEditing={(e) => {
              handleSubmit(e)
              e.preventDefault()
            }}
            autoFocus={true}
          />
        </View>
      </View>
    </SafeAreaView>
  )
}
