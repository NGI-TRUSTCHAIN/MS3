import Header from "@/components/Header";
import Container from "@/components/ui/Container";
import SectionTitle from "@/components/ui/SectionTitle";
import UsecaseList from "@/components/UsecaseList";

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Container>
          <SectionTitle>Use Cases</SectionTitle>
          <p className="text-gray-600 mb-6">
            Explore how to integrate M3S modules into your dApp using real-world examples:
          </p>
          <UsecaseList />
        </Container>
      </main>
    </>
  );
}
