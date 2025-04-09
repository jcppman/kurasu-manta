import { SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native'

export default function App() {
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
        Hello
      </View>
    </SafeAreaView>
  )
}
