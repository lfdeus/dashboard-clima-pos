import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SearchBarComponent } from './search-bar.component';

describe('SearchBarComponent', () => {
  let fixture: ComponentFixture<SearchBarComponent>;
  let component: SearchBarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SearchBarComponent] }).compileComponents();
    fixture = TestBed.createComponent(SearchBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('emits searchSubmitted on form submit when value is valid', () => {
    spyOn(component.searchSubmitted, 'emit');
    component.setValue('Lisbon');
    component['form'].controls.city.setValue('Lisbon');
    component.onSubmit();
    expect(component.searchSubmitted.emit).toHaveBeenCalledWith('Lisbon');
  });

  it('does not emit submit when input is shorter than 2 characters', () => {
    spyOn(component.searchSubmitted, 'emit');
    component['form'].controls.city.setValue('a');
    component.onSubmit();
    expect(component.searchSubmitted.emit).not.toHaveBeenCalled();
  });

  it('emits searchTyped after debounce when typing', fakeAsync(() => {
    spyOn(component.searchTyped, 'emit');
    component['form'].controls.city.setValue('São Paulo');
    tick(component.debounceMs());
    expect(component.searchTyped.emit).toHaveBeenCalledWith('São Paulo');
  }));

  it('renders an accessible search role', () => {
    const form = fixture.debugElement.query(By.css('form'));
    expect(form.nativeElement.getAttribute('role')).toBe('search');
  });
});
