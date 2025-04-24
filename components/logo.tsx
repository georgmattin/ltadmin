import Link from "next/link"
import Image from "next/image"

export function Logo() {
  return (
    <Link href="/" className="flex items-center">
      <Image 
        src="/logo (5).png" 
        alt="leiatoetus.ee logo" 
        width={250} 
        height={80} 
        className="h-auto w-auto" 
        priority
      />
    </Link>
  )
}
