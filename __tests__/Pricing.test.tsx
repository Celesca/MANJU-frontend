import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Pricing from '../src/pages/Pricing';
import '@testing-library/jest-dom';

// Mock Navbar
jest.mock('../src/components/Navbar', () => () => <div data-testid="navbar">Navbar</div>);

// Mock PricingFeature to avoid testing child logic deeply
jest.mock('../src/components/PricingFeature', () => ({ children }: any) => <li data-testid="pricing-feature">{children}</li>);

describe('Pricing', () => {
    it('renders the navbar', () => {
        render(
            <MemoryRouter>
                <Pricing />
            </MemoryRouter>
        );
        expect(screen.getByTestId('navbar')).toBeInTheDocument();
    });

    it('renders the main title', () => {
        render(
            <MemoryRouter>
                <Pricing />
            </MemoryRouter>
        );
        expect(screen.getByText(/เลือกแพ็กเกจที่เหมาะกับ/i)).toBeInTheDocument();
        expect(screen.getByText(/ขนาดธุรกิจของคุณ/i)).toBeInTheDocument();
    });

    it('toggles between Monthly and Yearly pricing', () => {
        render(
            <MemoryRouter>
                <Pricing />
            </MemoryRouter>
        );

        // Initial state is Yearly (true)
        // Pro Business price for Yearly is ฿290
        expect(screen.getByText('฿290')).toBeInTheDocument();

        // Find the toggle button
        const toggleButton = screen.getByLabelText('Toggle pricing period');
        
        // Click to switch to Monthly
        fireEvent.click(toggleButton);

        // Pro Business price for Monthly is ฿350
        expect(screen.getByText('฿350')).toBeInTheDocument();
        // ฿290 should not be present (or at least not visible as main price)
        // Note: queryByText returns null if not found
        expect(screen.queryByText('฿290')).not.toBeInTheDocument();
    });

    it('renders all pricing plans', () => {
        render(
            <MemoryRouter>
                <Pricing />
            </MemoryRouter>
        );
        expect(screen.getByText('Starter')).toBeInTheDocument();
        expect(screen.getByText('Pro Business')).toBeInTheDocument();
        expect(screen.getByText('Enterprise')).toBeInTheDocument();
    });
});
