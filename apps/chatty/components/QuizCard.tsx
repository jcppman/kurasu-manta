import type { ShowQuizParameters } from '@repo/chatty-schema/chat'
import React, { useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'

export default function QuizCard({ quiz }: { quiz: ShowQuizParameters }) {
  const [flipped, setFlipped] = useState(false)

  const handlePress = () => {
    setFlipped(!flipped)
  }

  return (
    <TouchableOpacity onPress={handlePress}>
      <View
        style={{
          padding: 16,
          backgroundColor: 'white',
          borderRadius: 8,
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        {flipped ? (
          <>
            <Text>Answer:</Text>
            <Text>{quiz.answer}</Text>
          </>
        ) : (
          <>
            <Text>{quiz.question}</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  )
}
