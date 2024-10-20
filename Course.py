class Course:
    def __init__(self, id, name, subject, number):
        self.id = id
        self.name = name
        self.subject = subject
        self.number = number
        self.requisites = []
