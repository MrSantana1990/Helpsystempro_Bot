import Container from "./Container";

export default function SectionHeader({
  id,
  eyebrow,
  title,
  subtitle
}: {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div id={id} className="scroll-mt-24 pt-14 sm:pt-20">
      <Container>
        <div className="max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</div>
          <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-text sm:text-3xl">
            {title}
          </h2>
          <p className="mt-3 text-pretty text-sm text-muted sm:text-base">{subtitle}</p>
        </div>
      </Container>
    </div>
  );
}

