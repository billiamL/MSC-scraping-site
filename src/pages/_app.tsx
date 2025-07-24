import type { AppProps } from 'next/app'
import '../styles/globals.css'  // Change this line
import '../styles/vendor.css'   // And this line

function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}

export default MyApp
