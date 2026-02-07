import { render, screen } from '@testing-library/react';
import AboutPage from '../src/pages/About';
import '@testing-library/jest-dom';

// 1. Mock ข้อมูล JSON (สมมติข้อมูลเพื่อใช้เช็คใน test)
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

// 2. Mock Component ภายนอก
jest.mock('../src/components/Navbar', () => () => <div data-testid="navbar">Navbar</div>);

// 3. Mock รูปภาพ (เพื่อให้ Jest ไม่บ่นเรื่องหาไฟล์รูปไม่เจอ)
jest.mock('../src/assets/folk.png', () => 'test-file-stub');
jest.mock('../src/assets/otwo.jpg', () => 'test-file-stub');
jest.mock('../src/assets/kaew.png', () => 'test-file-stub');

describe('AboutPage Component', () => {
  
  it('renders hero section correctly', () => {
    render(<AboutPage />);
    
    // เช็คหัวข้อหลัก
    expect(screen.getByText(/Meet the/i)).toBeInTheDocument();
    expect(screen.getByText(/MANJU Team/i)).toBeInTheDocument();
    
    // เช็คว่า Navbar ขึ้นไหม
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
  });

  it('renders team members from JSON data', () => {
    render(<AboutPage />);

    // เช็คชื่อสมาชิก (จาก Mock data) - อาจมีหลายที่ (Hero + Detail)
    expect(screen.getAllByText('Sawit').length).toBeGreaterThan(0);
    
    // เช็ค Role
    expect(screen.getAllByText('Full Stack Developer').length).toBeGreaterThan(0);
    
    // เช็คชื่อเล่นใน Floating Badge
    expect(screen.getAllByText('Folk').length).toBeGreaterThan(0);
  });

  it('displays skills and achievements correctly', () => {
    render(<AboutPage />);

    // เช็ค Skills
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();

    // เช็ค Achievements
    expect(screen.getByText('First Place in Hackathon')).toBeInTheDocument();
  });

  it('has correct social links', () => {
    render(<AboutPage />);

    // เช็ค GitHub Link
    const githubLink = screen.getByRole('link', { name: /github/i });
    expect(githubLink).toHaveAttribute('href', 'https://github.com');

    // เช็ค Email Link
    const emailLink = screen.getByRole('link', { name: /mail/i });
    expect(emailLink).toHaveAttribute('href', 'mailto:test@test.com');
  });

  it('contains contact team button with correct mailto', () => {
    render(<AboutPage />);
    
    const contactBtn = screen.getByText(/Contact Our Team/i);
    expect(contactBtn.closest('a')).toHaveAttribute('href', expect.stringContaining('mailto:'));
  });

});