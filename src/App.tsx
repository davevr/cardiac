import { useCardiac } from './cardiac/useCardiac'
import { Card } from './components/Card'
import { Panel } from './components/Panel'

export default function App() {
  const cardiac = useCardiac()
  return (
    <main className="desk">
      <Card cardiac={cardiac} />
      <Panel cardiac={cardiac} />
    </main>
  )
}
