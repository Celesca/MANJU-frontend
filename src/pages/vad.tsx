
import { useMicVAD } from "@ricky0123/vad-react"

const MyComponent = () => {
    const vad = useMicVAD({
        onSpeechEnd: (audio) => {
        console.log("User stopped talking");
        },
    })
    return <div>{vad.userSpeaking && "User is speaking"}</div>
}

export default MyComponent