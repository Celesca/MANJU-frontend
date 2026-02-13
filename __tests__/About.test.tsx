import { render, screen } from '@testing-library/react';
import AboutPage from '../src/pages/About';
import '@testing-library/jest-dom';

// 1. Mock JSON
jest.mock('../src/documents/Data-About.json', () => [
  {
    "id": "member-1",
    "name": "Sawit",
    "nickname": "Folk",
    "role": "Full Stack Developer",
    "bio": "I love coding",
    "img": "../assets/folk.png",
    "color": "from-violet-500 to-indigo-500",
    "skills": ["React", "TypeScript"],
    "achievements": ["First Place in Hackathon"],
    "socials": {
      "github": "https://github.com",
      "email": "test@test.com",
      "linkedin": "https://linkedin.com"
    }
  }
]);

// 2. Mock Component
jest.mock('../src/components/Navbar', () => () => <div data-testid="navbar">Navbar</div>);

// 3. Mock image
jest.mock('../src/assets/folk.png', () => 'test-file-stub');
jest.mock('../src/assets/otwo.jpg', () => 'test-file-stub');
jest.mock('../src/assets/kaew.png', () => 'test-file-stub');

describe('AboutPage Component', () => {
  
  it('renders hero section correctly', () => {
    render(<AboutPage />);
    
    // Check main title
    expect(screen.getByText(/Meet the/i)).toBeInTheDocument();
    expect(screen.getByText(/MANJU Team/i)).toBeInTheDocument();
    
    // Check Navbar
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
  });

  it('renders team members from JSON data', () => {
    render(<AboutPage />);

    // Check member name
    expect(screen.getAllByText('Sawit').length).toBeGreaterThan(0);
    
    // Check role
    expect(screen.getAllByText('Full Stack Developer').length).toBeGreaterThan(0);
    
    // Check Floating Badge
    expect(screen.getAllByText('Folk').length).toBeGreaterThan(0);
  });

  it('displays skills and achievements correctly', () => {
    render(<AboutPage />);

    // Check skills
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();

    // Check achievements
    expect(screen.getByText('First Place in Hackathon')).toBeInTheDocument();
  });

  it('has correct social links', () => {
    render(<AboutPage />);

    // Check GitHub Link
    const githubLink = screen.getByRole('link', { name: /github/i });
    expect(githubLink).toHaveAttribute('href', 'https://github.com');

    // Check Email Link
    const emailLink = screen.getByRole('link', { name: /mail/i });
    expect(emailLink).toHaveAttribute('href', 'mailto:test@test.com');
  });

  it('contains contact team button with correct mailto', () => {
    render(<AboutPage />);
    
    const contactBtn = screen.getByText(/Contact Our Team/i);
    expect(contactBtn.closest('a')).toHaveAttribute('href', expect.stringContaining('mailto:'));
  });

});