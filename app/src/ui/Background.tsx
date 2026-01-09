// ui/Background.tsx

export const Background = () => {
    return (
        <div
            className="stage fixed inset-0 pointer-events-none"
            style={{
                filter:
                    "blur(var(--blur)) brightness(calc(1 + (var(--intensity,1) - 1) * 0.25))",
            }}
        >
            <div className="blob b1"></div>
            <div className="blob b2"></div>
            <div className="blob b3"></div>
        </div>
    )
}
